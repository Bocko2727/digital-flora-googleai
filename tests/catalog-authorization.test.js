// fallow-ignore-file unused-file
import assert from 'node:assert/strict';
import test from 'node:test';
import { canPerformCatalogWrite } from '../src/auth/catalog-authorization.js';

test('anonymous and viewer roles cannot write catalog records', () => {
    assert.equal(canPerformCatalogWrite(undefined, 'POST'), false);
    assert.equal(canPerformCatalogWrite('viewer', 'POST'), false);
    assert.equal(canPerformCatalogWrite('viewer', 'PUT'), false);
    assert.equal(canPerformCatalogWrite('viewer', 'DELETE'), false);
});

test('editor can insert and update but cannot delete', () => {
    assert.equal(canPerformCatalogWrite('editor', 'POST'), true);
    assert.equal(canPerformCatalogWrite('editor', 'PUT'), true);
    assert.equal(canPerformCatalogWrite('editor', 'DELETE'), false);
});

test('admin can perform catalog writes including delete', () => {
    assert.equal(canPerformCatalogWrite('admin', 'POST'), true);
    assert.equal(canPerformCatalogWrite('admin', 'PUT'), true);
    assert.equal(canPerformCatalogWrite('admin', 'DELETE'), true);
});