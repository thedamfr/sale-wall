import 'dotenv/config'
import path from "node:path";
import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import pug from "pug";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const app = Fastify({ logger: true });

// Views (Pug)
await app.register(fastifyView, {
  engine: { pug },
  root: path.join(__dirname, "server/views")
});

// Static (CSS)
app.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/"
});

// Route home
app.get("/", (req, reply) =>
  reply.view("index.pug", { title: "Saleté Sincère" })
);

// Route manifeste
app.get("/manifeste", (req, reply) =>
  reply.view("manifeste.pug", { title: "Manifeste" })
);

// Health
app.get("/health", () => ({ ok: true }));

await app.listen({ host: "0.0.0.0", port: process.env.PORT || 3000 });
