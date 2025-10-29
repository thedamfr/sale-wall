import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../helpers/app.js';

describe('GET /podcast route', () => {
  let app;

  before(async () => {
    app = await build();
  });

  after(async () => {
    await app.close();
  });

  describe('without query params', () => {
    it('should return classic podcast page (200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast'
      });

      assert.strictEqual(response.statusCode, 200);
      assert.match(response.headers['content-type'], /text\/html/);
      assert.match(response.body, /Charbon.*Wafer/); // Title présent
    });
  });

  describe('with valid season and episode params', () => {
    it('should return episode highlight for S2E1', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=2&episode=1'
      });

      assert.strictEqual(response.statusCode, 200);
      assert.match(response.headers['content-type'], /text\/html/);
      
      // Vérifie présence encart épisode
      assert.match(response.body, /Saison 2.*Épisode 1/);
      assert.match(response.body, /Une collaboration/); // Titre épisode
      
      // Vérifie headers cache
      assert.match(response.headers['cache-control'], /public.*max-age=3600/);
    });

    it('should return episode highlight for S1E5', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=1&episode=5'
      });

      assert.strictEqual(response.statusCode, 200);
      assert.match(response.body, /BOUCLIER/);
    });
  });

  describe('with invalid params', () => {
    it('should return classic page for non-numeric season', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=abc&episode=1'
      });

      assert.strictEqual(response.statusCode, 200);
      // Page classique (pas d'encart épisode)
      assert.doesNotMatch(response.body, /Saison.*Épisode/);
    });

    it('should return classic page for XSS attempt', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=1&episode=<script>alert(1)</script>'
      });

      assert.strictEqual(response.statusCode, 200);
      assert.doesNotMatch(response.body, /<script>/);
    });

    it('should return classic page for non-existent episode', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=99&episode=99'
      });

      assert.strictEqual(response.statusCode, 200);
      assert.doesNotMatch(response.body, /Saison 99/);
    });
  });

  describe('cache headers', () => {
    it('should set cache headers for successful episode fetch', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=2&episode=1'
      });

      assert.match(response.headers['cache-control'], /public/);
      assert.match(response.headers['cache-control'], /max-age=3600/);
      assert.match(response.headers['cache-control'], /s-maxage=3600/);
    });
  });
});
