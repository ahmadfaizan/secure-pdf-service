'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');

const ROOT = path.join(__dirname, '..');

before(() => {
    fs.mkdirSync(path.join(ROOT, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(ROOT, 'processed'), { recursive: true });
});

describe('server', () => {
    let app;

    before(() => {
        app = require('../server');
    });

    describe('GET /api/health', () => {
        it('returns the running service message', async () => {
            const res = await request(app).get('/api/health').expect(200);
            assert.equal(res.text, 'Secure PDF Service is running.');
        });
    });

    describe('POST /api/decrypt', () => {
        it('returns 400 when no file is uploaded', async () => {
            await request(app)
                .post('/api/decrypt')
                .expect(400)
                .expect('No file uploaded.');
        });

        it('returns PDF bytes and headers for a valid unencrypted PDF', async () => {
            const doc = await PDFDocument.create();
            doc.addPage();
            const pdfBytes = Buffer.from(await doc.save());

            const res = await request(app)
                .post('/api/decrypt')
                .field('password', '')
                .attach('file', pdfBytes, 'sample.pdf')
                .expect(200);

            assert.equal(res.headers['content-type'], 'application/pdf');
            assert.match(
                res.headers['content-disposition'],
                /attachment; filename="sample\.pdf"/
            );
            const body = Buffer.isBuffer(res.body)
                ? res.body
                : Buffer.from(res.body);
            const roundTrip = await PDFDocument.load(body);
            assert.equal(roundTrip.getPageCount(), 1);
        });

        it('returns 500 when the upload is not a valid PDF', async () => {
            const res = await request(app)
                .post('/api/decrypt')
                .attach('file', Buffer.from('not a pdf'), 'bad.bin')
                .expect(500);

            assert.match(res.text, /Error processing PDF/);
        });
    });
});
