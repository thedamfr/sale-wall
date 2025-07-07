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
  root: path.join(__dirname, "views")
});

// Static (CSS)
app.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/public/"
});

// Route home
app.get("/", (req, reply) =>
  reply.view("index.pug", { title: "Saleté Sincère" })
);

// Health
app.get("/health", () => ({ ok: true }));

await app.listen({ host: "0.0.0.0", port: process.env.PORT || 3000 });
