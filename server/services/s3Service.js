/**
 * Service S3 pour upload/delete d'assets (OG Images, etc.)
 * Phase 3: OG Images dans s3://salete-media/og-images/
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Configuration S3 (MinIO local ou Cellar production)
const s3Config = {
  endpoint: process.env.CELLAR_ADDON_HOST || process.env.S3_ENDPOINT || 'http://localhost:9000',
  credentials: {
    accessKeyId: process.env.CELLAR_ADDON_KEY_ID || process.env.S3_ACCESS_KEY || 'salete',
    secretAccessKey: process.env.CELLAR_ADDON_KEY_SECRET || process.env.S3_SECRET_KEY || 'salete123',
  },
  region: 'us-east-1',
  forcePathStyle: true,
  maxAttempts: 2,
  requestTimeout: 8000,
  connectTimeout: 3000,
  signatureVersion: 'v4'
};

const s3Client = new S3Client(s3Config);
const bucketName = process.env.S3_BUCKET || 'salete-media';

/**
 * Upload un buffer vers S3
 * @param {Buffer} buffer - Buffer à uploader (ex: PNG OG Image)
 * @param {string} key - Clé S3 (ex: 'og-images/s2e1.png')
 * @param {string} contentType - MIME type (défaut 'image/png')
 * @returns {Promise<string>} URL publique de l'objet
 */
export async function uploadToS3(buffer, key, contentType = 'image/png') {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read' // OG Images doivent être publiques
  });
  
  await s3Client.send(command);
  
  // Construire URL publique
  const endpoint = s3Config.endpoint.replace('http://', '').replace('https://', '');
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.CELLAR_ADDON_HOST;
  
  if (isProduction) {
    // Production: URL Cellar optimisée
    return `https://${endpoint}/${bucketName}/${key}`;
  } else {
    // Local MinIO
    return `http://${endpoint}/${bucketName}/${key}`;
  }
}

/**
 * Supprime un objet de S3
 * @param {string} key - Clé S3 à supprimer
 * @returns {Promise<void>}
 */
export async function deleteFromS3(key) {
  if (!key) return; // Skip si pas de clé
  
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  });
  
  await s3Client.send(command);
}
