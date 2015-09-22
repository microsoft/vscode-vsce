import * as fs from 'fs';
import * as path from 'path';
import { Promise, nfcall, resolve, reject } from 'q';
import { home } from 'osenv';
import { read } from './util';
import { WebApi, getBasicHandler } from 'vso-node-api/WebApi';

const credentialsPath = path.join(home(), '.vsce');

export interface ICredentials {
	account: string;
	publisher: string;
	pat: string;
}

export interface IGetCredentialsOptions {
	promptToOverwrite?: boolean;
	promptIfMissing?: boolean;
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
		if (!/^https?:\/\//.test(account)) {
			account = `https://${ account }.visualstudio.com`;
			console.log(`Assuming account name '${ account }'`);
		}
		
		return read('Publisher:').then(publisher => {
			return read('Personal Access Token:', { silent: true, replace: '*' })
				.then(pat => ({ account, publisher, pat }));
		});
	});
}

export function getCredentials(options: IGetCredentialsOptions = {}): Promise<ICredentials> {
	return readCredentials()
		.then(credentials => {
			if (!credentials || !options.promptToOverwrite) {
				return resolve(credentials);
			}
			
			console.log(`Existing credentials found: { account: ${ credentials.account }, publisher: ${ credentials.publisher } }`);
			return read('Do you want to overwrite existing credentials? [y/N] ')
				.then<ICredentials>(answer => /^y$/i.test(answer) ? null : credentials);
		})
		.then(credentials => {
			if (credentials || !options.promptIfMissing) {
				return resolve(credentials);
			}
			
			return promptForCredentials()
				.then(writeCredentials);
		});
}

const galleryUrl = 'https://app.market.visualstudio.com';

export function login(): Promise<ICredentials> {
	return getCredentials({ promptIfMissing: true, promptToOverwrite: true }).then(credentials => {
		const authHandler = getBasicHandler('oauth', credentials.pat);
		const vsoapi = new WebApi(credentials.account, authHandler);
		const api = vsoapi.getQGalleryApi(galleryUrl);
		
		return api.getPublisher(credentials.publisher).then(publisher => {
			console.log(`Authentication successful. Found publisher '${ publisher.displayName }'.`);
			return credentials;
		});
	});
}

export function logout(): Promise<any> {
	return clearCredentials();
}