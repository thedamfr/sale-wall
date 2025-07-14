/**
 * Validateur audio pour les enregistrements vocaux
 * Phase 2: Validation audio 30s minimum côté serveur
 */

const SUPPORTED_FORMATS = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'];
const MIN_DURATION_MS = 30000; // 30 secondes en millisecondes
const MAX_DURATION_MS = 300000; // 5 minutes en millisecondes
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Valide un fichier audio
 * @param {Buffer} audioBuffer - Le buffer du fichier audio
 * @param {string} mimeType - Le type MIME du fichier
 * @param {number} recordingDuration - La durée d'enregistrement en millisecondes
 * @returns {Object} Résultat de la validation
 */
function validateAudio(audioBuffer, mimeType, recordingDuration) {
  const errors = [];

  // Vérifier la taille du fichier
  if (!audioBuffer || audioBuffer.length === 0) {
    errors.push('Le fichier audio est vide');
  } else if (audioBuffer.length > MAX_FILE_SIZE) {
    errors.push(`Le fichier audio dépasse la taille maximale autorisée (${MAX_FILE_SIZE / (1024 * 1024)}MB)`);
  }

  // Vérifier le format
  if (!mimeType || !SUPPORTED_FORMATS.some(format => mimeType.includes(format))) {
    errors.push(`Format audio non supporté. Formats acceptés: ${SUPPORTED_FORMATS.join(', ')}`);
  }

  // Vérifier la durée (priorité à la durée fournie par le client)
  if (!recordingDuration || recordingDuration < MIN_DURATION_MS) {
    errors.push(`L'enregistrement doit durer au moins ${MIN_DURATION_MS / 1000} secondes`);
  } else if (recordingDuration > MAX_DURATION_MS) {
    errors.push(`L'enregistrement ne peut pas dépasser ${MAX_DURATION_MS / 1000} secondes`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    validatedData: {
      size: audioBuffer.length,
      mimeType: mimeType,
      duration: recordingDuration
    }
  };
}

/**
 * Middleware Fastify pour valider les uploads audio
 */
async function audioValidationMiddleware(request, reply) {
  try {
    const data = await request.file();
    
    if (!data) {
      return reply.status(400).send({
        error: 'Aucun fichier audio fourni'
      });
    }

    const audioBuffer = await data.toBuffer();
    const mimeType = data.mimetype;
    const recordingDuration = request.body?.duration ? parseInt(request.body.duration) : null;

    const validation = validateAudio(audioBuffer, mimeType, recordingDuration);

    if (!validation.isValid) {
      return reply.status(400).send({
        error: 'Fichier audio invalide',
        details: validation.errors
      });
    }

    // Ajouter les données validées à la request pour les utiliser dans la route
    request.validatedAudio = {
      buffer: audioBuffer,
      mimetype: mimeType,
      filename: data.filename,
      duration: recordingDuration
    };

  } catch (error) {
    request.log.error('Erreur lors de la validation audio:', error);
    return reply.status(500).send({
      error: 'Erreur lors de la validation du fichier audio'
    });
  }
}

export {
  validateAudio,
  audioValidationMiddleware,
  SUPPORTED_FORMATS,
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  MAX_FILE_SIZE
};
