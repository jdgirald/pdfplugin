import { expect, test } from '@salesforce/command/lib/test';
import { ensureJsonMap, ensureString } from '@salesforce/ts-types';
import { existsSync, unlinkSync } from 'fs';

describe('bbpdf:pdf', () => {
  beforeEach(() => {
    ['./test/output/contact.pdf', './test/output/contact2.pdf'].forEach(name => {
      try {
        unlinkSync(name);
        } catch (e) {
        }
    });
  });

  describe('success with query file', () => {
    test
      .withOrg({ username: 'test@bbpdf.com' }, true)
      .withConnectionRequest(request => {
        const requestMap = ensureJsonMap(request);
        if (ensureString(requestMap.url).match(/Contact/)) {
          return Promise.resolve({ records: [{ Title: 'Mr', FirstName: 'Bob', LastName: 'Buzzard' }] });
        }
        return Promise.resolve({ records: [] });
      })
      .stdout()
      .command(['bbpdf:pdf', '--targetusername', 'test@bbpdf.com', '-d', './test/templates', '-t', 'contact.ejs',
        '-f', './test/queries/contact-query.json', '-o', './test/output/contact.pdf'])
      .it('runs bbpdf:pdf', ctx => {
        expect(existsSync('./test/output/contact.pdf')).to.be.equal(true, 'Expected pdf file');
        expect(ctx.stdout).to.contain('PDF file succesfully written');
      });
  });

  describe('success with inline query', () => {
    test
      .withOrg({ username: 'test@bbpdf.com' }, true)
      .withConnectionRequest(request => {
        const requestMap = ensureJsonMap(request);
        if (ensureString(requestMap.url).match(/Contact/)) {
          return Promise.resolve({ records: [{ Title: 'Mr', FirstName: 'Bob', LastName: 'Buzzard' }] });
        }
        return Promise.resolve({ records: [] });
      })
      .stdout()
      .command(['bbpdf:pdf', '--targetusername', 'test@bbpdf.com', '-d', './test/templates', '-t', 'contact.ejs',
        '-q', 'select Title, FirstName, LastName from Contact', '-s', 'contact', '-o', './test/output/contact2.pdf'])
      .it('runs bbpdf:pdf', ctx => {
        expect(existsSync('./test/output/contact2.pdf')).to.be.equal(true, 'Expected pdf file');
        expect(ctx.stdout).to.contain('PDF file succesfully written');
      });
  });

  describe('fails because query and queries are both defined', () => {
    test
      .stderr()
      .command(['bbpdf:pdf', '--targetusername', 'test@bbpdf.com', '-d', './test/templates', '-t', 'contact.ejs',
        '-f', './test/queries/contact-query.json', '-q', 'query', '-o', './test/output/contact3.pdf'])
      .it('runs bbpdf:pdf', ctx => {
        expect(ctx.stderr).to.contain('queries flag may not be used with query or sobject name');
      });
  });

  describe('fails because sobject and queries are both defined', () => {
    test
      .stderr()
      .command(['bbpdf:pdf', '--targetusername', 'test@bbpdf.com', '-d', './test/templates', '-t', 'contact.ejs',
        '-f', './test/queries/contact-query.json', '-s', 'contact', '-o', './test/output/contact.pdf'])
      .it('runs bbpdf:pdf', ctx => {
        expect(ctx.stderr).to.contain('queries flag may not be used with query or sobject name');
      });
  });

  describe('fails because sobject and query are not both defined', () => {
    test
      .stderr()
      .command(['bbpdf:pdf', '--targetusername', 'test@bbpdf.com', '-d', './test/templates', '-t', 'contact.ejs',
               '-s', 'contact', '-o', './test/output/contact.pdf'])
      .it('runs bbpdf:pdf', ctx => {
        expect(ctx.stderr).to.contain('query and sobject name must both be specified');
      });
  });
});
