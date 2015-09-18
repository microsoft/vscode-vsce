import * as fs from 'fs';
import * as path from 'path';
import { Promise, nfcall, resolve, reject } from 'q';
import { home } from 'osenv';
import read = require('read');

const credentialsPath = path.join(home(), '.vsce');

interface ICredentials {
	account: string;
	publisher: string;
	pat: string;
}

function readCredentials(): Promise<ICredentials> {
	return nfcall<string>(fs.readFile, credentialsPath, 'utf8')
		.catch<string>(err => err.code !== 'ENOENT' ? reject(err) : resolve('null'))
		.then<ICredentials>(credentialsStr => {
			try {
				return resolve(JSON.parse(credentialsStr));
			} catch (e) {
				return reject(`Error parsing credentials: ${ credentialsPath }`);
			}
		});
}

function writeCredentials(credentials: ICredentials): Promise<ICredentials> {
	return nfcall<void>(fs.writeFile, credentialsPath, JSON.stringify(credentials))
		.then(() => credentials);
}

function clearCredentials(): Promise<void> {
	return nfcall<void>(fs.unlink, credentialsPath);
}

function promptForCredentials(): Promise<ICredentials> {
	return nfcall<string>(read, { prompt: 'Account name:' }).spread(account => {
		return nfcall<string>(read, { prompt: 'Publisher:' }).spread(publisher => {
			return nfcall<string>(read, { prompt: 'Personal Access Token:', silent: true, replace: '*' })
				.spread(pat => ({ account, publisher, pat }));
		});
	});
}

export function getCredentials(): Promise<ICredentials> {
	return login(false);
}

export function login(relogin = true): Promise<ICredentials> {
	return readCredentials()
		.then(credentials => {
			if (!credentials || !relogin) {
				return resolve(credentials);
			}
			
			console.log(`Existing credentials found: { account: ${ credentials.account }, publisher: ${ credentials.publisher } }`);
			return nfcall<string>(read, { prompt: 'Do you want to overwrite existing credentials? [y/N] ' })
				.spread<ICredentials>(answer => /^y$/i.test(answer) ? promptForCredentials() : credentials);
		})
		.then(credentials => credentials || promptForCredentials())
		.then(writeCredentials);
}

export function logout(): Promise<any> {
	return clearCredentials();
}