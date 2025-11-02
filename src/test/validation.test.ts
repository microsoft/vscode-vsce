import * as assert from 'assert';
import {
	validatePublisher,
	validateExtensionName,
	validateVersion,
	validateEngineCompatibility,
	validateVSCodeTypesCompatibility,
	validateExtensionDependencies,
} from '../validation';

describe('validatePublisher', () => {
	it('should throw with empty', () => {
		assert.throws(() => validatePublisher(null!));
		assert.throws(() => validatePublisher(undefined!));
		assert.throws(() => validatePublisher(''));
	});

	it('should validate', () => {
		validatePublisher('hello');
		validatePublisher('Hello');
		validatePublisher('HelloWorld');
		validatePublisher('Hello-World');
		validatePublisher('Hell0-World');

		assert.throws(() => validatePublisher('hello.'));
		assert.throws(() => validatePublisher('.hello'));
		assert.throws(() => validatePublisher('h ello'));
		assert.throws(() => validatePublisher('hello world'));
		assert.throws(() => validatePublisher('-hello'));
		assert.throws(() => validatePublisher('-'));
	});
});

describe('validateExtensionName', () => {
	it('should throw with empty', () => {
		assert.throws(() => validateExtensionName(null!));
		assert.throws(() => validateExtensionName(undefined!));
		assert.throws(() => validateExtensionName(''));
	});

	it('should validate', () => {
		validateExtensionName('hello');
		validateExtensionName('Hello');
		validateExtensionName('HelloWorld');
		validateExtensionName('Hello-World');
		validateExtensionName('Hell0-World');

		assert.throws(() => validateExtensionName('hello.'));
		assert.throws(() => validateExtensionName('.hello'));
		assert.throws(() => validateExtensionName('h ello'));
		assert.throws(() => validateExtensionName('hello world'));
		assert.throws(() => validateExtensionName('-hello'));
		assert.throws(() => validateExtensionName('-'));
	});
});

describe('validateVersion', () => {
	it('should throw with empty', () => {
		assert.throws(() => validateVersion(null!));
		assert.throws(() => validateVersion(undefined!));
		assert.throws(() => validateVersion(''));
	});

	it('should validate', () => {
		validateVersion('1.0.0');
		validateVersion('0.1.1');
		validateVersion('0.1.1-pre');

		assert.throws(() => validateVersion('.'));
		assert.throws(() => validateVersion('..'));
		assert.throws(() => validateVersion('0'));
		assert.throws(() => validateVersion('0.1'));
		assert.throws(() => validateVersion('.0.1'));
		assert.throws(() => validateVersion('0.1.'));
		assert.throws(() => validateVersion('0.0.0.1'));
		assert.throws(() => validateVersion('1.0-pre'));
		assert.throws(() => validateVersion('pre'));
	});
});

describe('validateEngineCompatibility', () => {
	it('should throw with empty', () => {
		assert.throws(() => validateEngineCompatibility(null!));
		assert.throws(() => validateEngineCompatibility(undefined!));
		assert.throws(() => validateEngineCompatibility(''));
	});

	it('should validate', () => {
		validateEngineCompatibility('*');

		validateEngineCompatibility('1.0.0');
		validateEngineCompatibility('1.0.x');
		validateEngineCompatibility('1.x.x');

		validateEngineCompatibility('^1.0.0');
		validateEngineCompatibility('^1.0.x');
		validateEngineCompatibility('^1.x.x');

		validateEngineCompatibility('>=1.0.0');
		validateEngineCompatibility('>=1.0.x');
		validateEngineCompatibility('>=1.x.x');

		assert.throws(() => validateVersion('0.0.0.1'));
		assert.throws(() => validateVersion('^0.0.0.1'));
		assert.throws(() => validateVersion('^1'));
		assert.throws(() => validateVersion('^1.0'));
		assert.throws(() => validateVersion('>=1'));
		assert.throws(() => validateVersion('>=1.0'));
	});
});

describe('validateVSCodeTypesCompatibility', () => {
	it('should validate', () => {
		validateVSCodeTypesCompatibility('*', '1.30.0');
		validateVSCodeTypesCompatibility('*', '^1.30.0');
		validateVSCodeTypesCompatibility('*', '~1.30.0');

		validateVSCodeTypesCompatibility('1.30.0', '1.30.0');
		validateVSCodeTypesCompatibility('1.30.0', '1.20.0');
		validateVSCodeTypesCompatibility('1.46.0', '1.45.1');
		validateVSCodeTypesCompatibility('1.45.0', '1.45.1');

		assert.throws(() => validateVSCodeTypesCompatibility('1.30.0', '1.40.0'));
		assert.throws(() => validateVSCodeTypesCompatibility('1.30.0', '^1.40.0'));
		assert.throws(() => validateVSCodeTypesCompatibility('1.30.0', '~1.40.0'));

		assert.throws(() => validateVSCodeTypesCompatibility('1.30.0', '1.40.0'));
		assert.throws(() => validateVSCodeTypesCompatibility('^1.30.0', '1.40.0'));
		assert.throws(() => validateVSCodeTypesCompatibility('~1.30.0', '1.40.0'));

		assert.throws(() => validateVSCodeTypesCompatibility('1.x.x', '1.30.0'));
		assert.throws(() => validateVSCodeTypesCompatibility('1.x.0', '1.30.0'));

		assert.throws(() => validateVSCodeTypesCompatibility('1.5.0', '1.30.0'));
		assert.throws(() => validateVSCodeTypesCompatibility('1.5', '1.30.0'));
		assert.throws(() => validateVSCodeTypesCompatibility('1.5', '1.30'));
	});
});

describe('validateExtensionDependencies', () => {
	it('should allow empty or undefined dependencies', () => {
		validateExtensionDependencies(undefined, 'extensionDependencies');
		validateExtensionDependencies([], 'extensionDependencies');
	});

	it('should allow lowercase extension IDs', () => {
		validateExtensionDependencies(['publisher.extension'], 'extensionDependencies');
		validateExtensionDependencies(['publisher.extension-name'], 'extensionDependencies');
		validateExtensionDependencies(['publisher-name.extension-name'], 'extensionDependencies');
		validateExtensionDependencies(['pub123.ext456'], 'extensionDependencies');
		validateExtensionDependencies(
			['publisher1.extension1', 'publisher2.extension2'],
			'extensionDependencies'
		);
	});

	it('should reject uppercase letters in extension IDs', () => {
		assert.throws(() => validateExtensionDependencies(['Publisher.extension'], 'extensionDependencies'));
		assert.throws(() => validateExtensionDependencies(['publisher.Extension'], 'extensionDependencies'));
		assert.throws(() => validateExtensionDependencies(['Publisher.Extension'], 'extensionDependencies'));
		assert.throws(() => validateExtensionDependencies(['PUBLISHER.EXTENSION'], 'extensionDependencies'));
	});

	it('should reject mixed case in extension IDs', () => {
		assert.throws(() => validateExtensionDependencies(['MyPublisher.my-extension'], 'extensionDependencies'));
		assert.throws(() => validateExtensionDependencies(['my-publisher.MyExtension'], 'extensionDependencies'));
	});

	it('should work with extensionPack field', () => {
		validateExtensionDependencies(['publisher.extension'], 'extensionPack');
		assert.throws(() => validateExtensionDependencies(['Publisher.Extension'], 'extensionPack'));
	});

	it('should list all invalid dependencies in error message', () => {
		try {
			validateExtensionDependencies(
				['valid.extension', 'Invalid.Extension', 'another.Valid', 'Another.Invalid'],
				'extensionDependencies'
			);
			assert.fail('Should have thrown an error');
		} catch (error: any) {
			assert.ok(error.message.includes('Invalid.Extension'));
			assert.ok(error.message.includes('Another.Invalid'));
			assert.ok(!error.message.includes('valid.extension'));
			assert.ok(!error.message.includes('another.Valid'));
		}
	});
});
