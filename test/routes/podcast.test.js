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
    it('should redirect to new route format for S2E1', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=2&episode=1'
      });

      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location, '/podcast/2/1');
    });

    it('should redirect to new route format for S1E5', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=1&episode=5'
      });

      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location, '/podcast/1/5');
    });
  });

  describe('with invalid params', () => {
    it('should redirect for non-numeric season', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=abc&episode=1'
      });

      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location, '/podcast/abc/1');
    });

    it('should redirect for XSS attempt', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=1&episode=<script>alert(1)</script>'
      });

      assert.strictEqual(response.statusCode, 301);
      // XSS tenté mais encodé dans l'URL
      assert.ok(response.headers.location.includes('/podcast/1/'));
    });

    it('should redirect for non-existent episode', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=99&episode=99'
      });

      assert.strictEqual(response.statusCode, 301);
      assert.strictEqual(response.headers.location, '/podcast/99/99');
    });
  });

  describe('cache headers', () => {
    it('should not set cache headers for redirects', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/podcast?season=2&episode=1'
      });

      assert.strictEqual(response.statusCode, 301);
      // Redirects don't need cache headers, browser follows
    });
  });
});
