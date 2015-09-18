import * as fs from 'fs';
import * as path from 'path';
import { Promise, nfcall, resolve, reject } from 'q';
import { home } from 'osenv';
import { read } from './util';

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

function clearCredentials(): Promise<any> {
	return nfcall(fs.unlink, credentialsPath)
		.catch(err => err.code !== 'ENOENT' ? reject(err) : resolve('null'));
}

function promptForCredentials(): Promise<ICredentials> {
	return read('Account name:').then(account => {
		return read('Publisher:').then(publisher => {
			return read('Personal Access Token:', { silent: true, replace: '*' })
				.then(pat => ({ account, publisher, pat }));
		});
	});
}

export function getCredentials(): Promise<ICredentials> {
	return readCredentials();
}

export function login(): Promise<ICredentials> {
	return readCredentials()
		.then(credentials => {
			if (!credentials) {
				return resolve(credentials);
			}
			
			console.log(`Existing credentials found: { account: ${ credentials.account }, publisher: ${ credentials.publisher } }`);
			return read('Do you want to overwrite existing credentials? [y/N] ')
				.then<ICredentials>(answer => /^y$/i.test(answer) ? promptForCredentials() : credentials);
		})
		.then(credentials => credentials || promptForCredentials())
		.then(writeCredentials);
}

export function logout(): Promise<any> {
	return clearCredentials();
}