import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { renderFile} from 'ejs';
import { readFileSync, writeFileSync  } from 'fs';
import { ncp } from 'ncp';
import { join } from 'path';
import { launch } from 'puppeteer-core';
import { dirSync } from 'tmp';
import { promisify } from 'util';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('bbpdf', 'pdf');

export default class Puppeteer extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx bbpdf:pdf -u user@org.com -d ./templates -t contact.ejs -o ./contact.pdf -s contact
     -q "select Title, FirstName, LastName, Account.Name from Contact where id='00380000023TUDeAAO'"
PDF file succesfully written to ./contact.pdf
  `,
  `$ sfdx bbpdf:pdf -u user@org.com -d ../templates -t opportunity.ejs -o ./opportunity.pdf -f ./queries.json
PDF file succesfully written to ./opportunity.pdf`

  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    template: flags.string({char: 't', description: messages.getMessage('templateFlagDescription')}),
    'template-dir': flags.string({char: 'd', description: messages.getMessage('templateDirFlagDescription')}),
    output: flags.string({char: 'o', description: messages.getMessage('outputFlagDescription')}),
    sobject: flags.string({char: 's', description: messages.getMessage('sobjectFlagDescription')}),
    query: flags.string({char: 'q', description: messages.getMessage('queryFlagDescription')}),
    'query-file': flags.string({char: 'f', description: messages.getMessage('queryFileFlagDescription')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {

    // this.org is guaranteed because requiresUsername=true, as opposed to supportsUsername
    const conn = this.org.getConnection();

    if ( ((undefined !== this.flags.query) || (undefined !== this.flags.sobject)) && (undefined !== this.flags['query-file']) ) {
      throw new SfdxError(messages.getMessage('errorQueryAndSObjectOrQueriesRequired'));
    } else if ( (this.flags.query && (!this.flags.sobject)) ||
                (!this.flags.query && (this.flags.sobject)) ) {
      throw new SfdxError(messages.getMessage('queryRequiresSObject'));
    }

    const content = {};
    if (this.flags.query) {
      const result = await conn.query<object>(this.flags.query);

      if (!result.records || result.records.length <= 0) {
        throw new SfdxError(messages.getMessage('errorNoQueryRecords', [this.flags.query]));
      } else {
        content[this.flags.sobject] = result.records[0];
      }
    } else {
      interface QueryEntry {
        'single': boolean;
        'query': string;
      }
      const queriesJSON = readFileSync(this.flags['query-file'], 'utf-8');
      const queries = JSON.parse(queriesJSON);

      for (const [key, value] of Object.entries(queries)) {
        const queryEntry = value as QueryEntry;
        const result = await conn.query<object>(queryEntry.query);

        if (!result.records || result.records.length <= 0) {
          throw new SfdxError(messages.getMessage('errorNoQueryRecords', [queryEntry.query]));
        } else {
          if (queryEntry.single) {
            content[key] = result.records[0];
          } else {
            content[key] = result.records;
          }
        }
      }
    }

    const html = await renderFile(join(this.flags['template-dir'], this.flags.template), content);

    const tmpDir = dirSync({ mode: 0o750, prefix: 'bbPDFtmp_' });

    const ncpPromisified = promisify(ncp);
    await ncpPromisified(this.flags['template-dir'], tmpDir.name);

    const htmlFile = join(tmpDir.name, 'tmp.html');
    writeFileSync(htmlFile, html);

    const browser = await launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
      });

    const page = await browser.newPage();

    await page.goto('file:///' + htmlFile, {waitUntil: 'networkidle0'});
    const pdf = await page.pdf({ format: 'A4' });

    await browser.close();

    writeFileSync(this.flags.output, pdf);

    this.log(messages.getMessage('successMessage', [this.flags.output]));

    return { success: true };
  }
}
