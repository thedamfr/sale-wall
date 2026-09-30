"""Run isolated storage journeys on OVH during an authorized Site maintenance.

Creates only its own fixture pod/PVC in the Site namespace. No production data
or Secret is read. The delivery timer must be stopped; the shared lock is held.
"""
import fcntl
import json
import secrets
import socket
import subprocess
import time

namespace = 'site-saletesincere'
prefix = ['microk8s', 'kubectl', '-n', namespace]
# Use the same PostgreSQL release as the database manifests.
image = 'postgres:17.6-alpine'
name = 'storage-journey-' + secrets.token_hex(4)


def kubectl(*args, resource=None, check=True):
    result = subprocess.run(
        ['/snap/bin/' + prefix[0], *prefix[1:], *args],
        input=json.dumps(resource) if resource is not None else None,
        text=True, capture_output=True, timeout=120,
    )
    if check and result.returncode:
        # Never print submitted Pod JSON, database output or credentials.
        raise RuntimeError('Kubernetes operation failed: ' + args[0])
    return result


def get(kind, resourceName):
    return json.loads(kubectl('get', kind, resourceName, '-o', 'json').stdout)


def claim(resourceName, storage='1Gi'):
    return {'apiVersion': 'v1', 'kind': 'PersistentVolumeClaim',
            'metadata': {'name': resourceName, 'namespace': namespace},
            'spec': {'accessModes': ['ReadWriteOnce'], 'storageClassName': 'microk8s-hostpath',
                     'resources': {'requests': {'storage': storage}}}}


def sql(statement, check=True):
    return kubectl('exec', name, '--', 'psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1',
                   '-U', 'storage_fixture', '-d', 'storage_fixture', '-c', statement, check=check)


def assertQuotaRefusal(resource):
    result = kubectl('create', '--dry-run=server', '-f', '-', resource=resource, check=False)
    assert result.returncode and 'exceeded quota' in result.stderr, 'Expected quota refusal'


assert socket.gethostname() == 'game-prod-ovh-gra', 'Unexpected host'
assert subprocess.run(['systemctl', 'is-active', '--quiet', 'site-saletesincere-delivery.timer']).returncode != 0, 'Stop the delivery timer first'
lock = open('/var/lib/site-saletesincere-delivery/activation.lock', 'a')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
quota = get('resourcequota', namespace)
assert quota['spec']['hard']['requests.storage'] == '3Gi', 'Expected final storage quota of 3Gi'
assert quota['spec']['hard']['persistentvolumeclaims'] == '3', 'Expected final PVC quota of 3'
assert quota['status']['used']['persistentvolumeclaims'] == '2', 'Expected two permanent claims'
for database in [namespace + '-postgres', namespace + '-staging-postgres']:
    pvc = get('pvc', 'data-' + database + '-0')
    assert pvc['status']['phase'] == 'Bound'
    assert pvc['spec']['resources']['requests']['storage'] == '1Gi'
    assert pvc['status']['capacity']['storage'] == '1Gi'
    sts = get('statefulset', database)
    assert sts['spec']['volumeClaimTemplates'][0]['spec']['resources']['requests']['storage'] == '1Gi'

# Refuse access if the existing isolation policy is absent or permissive.
isolation = get('networkpolicy', 'default-deny')['spec']
assert isolation['podSelector'] == {} and set(isolation['policyTypes']) == {'Ingress', 'Egress'}
assert not isolation.get('ingress') and not isolation.get('egress')

pod = {'apiVersion': 'v1', 'kind': 'Pod',
       'metadata': {'name': name, 'namespace': namespace,
                    'labels': {'app.kubernetes.io/component': 'storage-maintenance'}},
       'spec': {'automountServiceAccountToken': False, 'enableServiceLinks': False,
                'restartPolicy': 'Never', 'terminationGracePeriodSeconds': 30,
                'securityContext': {'runAsUser': 70, 'runAsGroup': 70, 'fsGroup': 70,
                                    'runAsNonRoot': True, 'seccompProfile': {'type': 'RuntimeDefault'}},
                'containers': [{'name': 'postgres', 'image': image,
                                'env': [{'name': 'POSTGRES_USER', 'value': 'storage_fixture'},
                                        {'name': 'POSTGRES_DB', 'value': 'storage_fixture'},
                                        {'name': 'POSTGRES_PASSWORD', 'value': secrets.token_urlsafe(32)},
                                        {'name': 'PGDATA', 'value': '/var/lib/postgresql/data/pgdata'}],
                                'resources': {'requests': {'cpu': '50m', 'memory': '128Mi'},
                                              'limits': {'cpu': '500m', 'memory': '512Mi'}},
                                'securityContext': {'allowPrivilegeEscalation': False, 'capabilities': {'drop': ['ALL']}},
                                'readinessProbe': {'exec': {'command': ['pg_isready', '-U', 'storage_fixture', '-d', 'storage_fixture']},
                                                   'periodSeconds': 2, 'timeoutSeconds': 2},
                                'volumeMounts': [{'name': 'data', 'mountPath': '/var/lib/postgresql/data'},
                                                {'name': 'run', 'mountPath': '/var/run/postgresql'}]}],
                'volumes': [{'name': 'data', 'persistentVolumeClaim': {'claimName': name}},
                            {'name': 'run', 'emptyDir': {'sizeLimit': '16Mi'}}]}}
createdClaim = False
createdPod = False
volumeName = None
try:
    assertQuotaRefusal(claim(name + '-too-large', '2Gi'))
    print('PASS: oversized allocation refused without mutation', flush=True)
    kubectl('create', '-f', '-', resource=claim(name))
    createdClaim = True
    kubectl('create', '-f', '-', resource=pod)
    createdPod = True
    kubectl('wait', 'pod/' + name, '--for=condition=Ready', '--timeout=90s')
    volumeName = get('pvc', name)['spec']['volumeName']
    # The test fixture may be deleted; permanent database volumes are never touched.
    assert get('pv', volumeName)['spec']['persistentVolumeReclaimPolicy'] == 'Delete'
    assertQuotaRefusal(claim(name + '-fourth'))
    sql("CREATE TABLE probe (id integer PRIMARY KEY, value text NOT NULL); INSERT INTO probe VALUES (1, 'persistent'); CREATE ROLE storage_reader NOLOGIN; GRANT SELECT ON probe TO storage_reader;")
    assert 'persistent' in sql('SET ROLE storage_reader; SELECT value FROM probe WHERE id=1;').stdout
    denied = sql("SET ROLE storage_reader; INSERT INTO probe VALUES (2, 'forbidden');", check=False)
    assert denied.returncode and 'permission denied' in denied.stderr
    # Back up and restore only the synthetic fixture, never an application database.
    kubectl('exec', name, '--', 'pg_dump', '-U', 'storage_fixture', '-d', 'storage_fixture', '-Fc', '-f', '/var/lib/postgresql/data/fixture.dump')
    sql('DROP TABLE probe;')
    kubectl('exec', name, '--', 'pg_restore', '-U', 'storage_fixture', '-d', 'storage_fixture', '--exit-on-error', '/var/lib/postgresql/data/fixture.dump')
    kubectl('delete', 'pod', name, '--wait=true', '--timeout=60s')
    createdPod = False
    kubectl('create', '-f', '-', resource=pod)
    createdPod = True
    kubectl('wait', 'pod/' + name, '--for=condition=Ready', '--timeout=90s')
    assert 'persistent' in sql('SET ROLE storage_reader; SELECT value FROM probe WHERE id=1;').stdout
    denied = sql("SET ROLE storage_reader; DELETE FROM probe;", check=False)
    assert denied.returncode and 'permission denied' in denied.stderr
    print('PASS: restore, durable reads/writes and role permissions survive pod recreation', flush=True)
finally:
    if createdPod:
        kubectl('delete', 'pod', name, '--wait=true', '--timeout=60s')
    if createdClaim:
        kubectl('delete', 'pvc', name, '--wait=true', '--timeout=60s')
    if volumeName:
        kubectl('wait', 'pv/' + volumeName, '--for=delete', '--timeout=60s')

# Wait for quota accounting to observe cleanup before testing recovery.
for attempt in range(30):
    if get('resourcequota', namespace)['status']['used']['persistentvolumeclaims'] == '2':
        break
    time.sleep(1)
else:
    raise RuntimeError('Fixture cleanup was not reflected in quota')
kubectl('create', '--dry-run=server', '-f', '-', resource=claim(name + '-recovery'))
print('PASS: quota refusal/recovery and fixture cleanup verified', flush=True)
