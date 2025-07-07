export default async function (fastify) {
  fastify.post('/api/recordings/:id/vote', async (req, reply) => {
    const { id } = req.params
    const voterHash = req.ip // simpliste; à raffiner
    await fastify.pg.query('INSERT INTO votes(recording_id, voter_hash) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, voterHash])
    await fastify.pg.query('UPDATE recordings SET votes = votes + 1 WHERE id = $1', [id])
    return { ok: true }
  })
}