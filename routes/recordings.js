export default async function (fastify) {
  fastify.post('/api/recordings', async (req, reply) => {
    const { type, wavUrl } = req.body
    const { rows } = await fastify.pg.query(
      'INSERT INTO recordings(wav_url,type) VALUES($1,$2) RETURNING id',
      [wavUrl, type]
    )
    return { id: rows[0].id }
  })

  fastify.get('/api/recordings', async (req) => {
    const { rows } = await fastify.pg.query(
      "SELECT * FROM recordings WHERE status='published' ORDER BY votes DESC, created_at DESC"
    )
    return rows
  })
}