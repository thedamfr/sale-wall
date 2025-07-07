import Fastify from 'fastify'
import postgres from '@fastify/postgres'
import fastifyVite from '@fastify/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const fastify = Fastify({ logger: true })

await fastify.register(postgres, { connectionString: process.env.DATABASE_URL })

await fastify.register(fastifyVite, {
  root: path.join(__dirname, '..', 'client'),
  dev: !isProd,
  preset: 'svelte5',
  renderToStringOptions: { streaming: true }
})

// -- API routes -------------------------------------------------
await fastify.register(import('./routes/recordings.js'))
await fastify.register(import('./routes/votes.js'))

// healthcheck
fastify.get('/health', (_, reply) => reply.send({ ok: true }))

await fastify.ready()
await fastify.listen({ port: process.env.PORT ?? 3000, host: '0.0.0.0' })
