import type { SecretLintRuleCreator } from "@secretlint/types";

// The recommended preset only reports PEM private keys whose Base64 body starts with "MI" or the OpenSSH magic and is at
// least 100 characters long. That skips short DER keys such as EC P-256 ("MHc…") and Ed25519 ("MC4…"), and it doesn't
// recognize ENCRYPTED PRIVATE KEY blocks at all. This rule reports exactly the keys the preset skips, so packaging still
// blocks every private key vsce blocked before.
const PEM_PRIVATE_KEY = /-----BEGIN ([A-Z0-9 ]*?)PRIVATE KEY-----([A-Za-z0-9+/=\r\n]{50,})-----END \1PRIVATE KEY-----/g;
const PRESET_KEY_TYPES = new Set(["", "RSA ", "DSA ", "EC ", "OPENSSH "]);

function isReportedByPreset(type: string, body: string, base64: string): boolean {
	return PRESET_KEY_TYPES.has(type)
		&& body.length <= 10000
		&& base64.length >= 100
		&& /^[A-Za-z0-9+/]+=*$/.test(base64)
		&& /^(MI|b3BlbnNzaC1rZXktdjE)/.test(base64);
}

const messages = {
	PrivateKey: {
		en: (props?: { KEY: string }) => `found private key: ${props?.KEY}`
	}
};

export const privateKeyRule: SecretLintRuleCreator = {
	messages,
	meta: {
		id: "vsce-rule-privatekey",
		recommended: true,
		type: "scanner",
		supportedContentTypes: ["text"]
	},
	create(context) {
		const t = context.createTranslator(messages);
		return {
			file(source) {
				for (const match of source.content.matchAll(PEM_PRIVATE_KEY)) {
					const [key, type, body] = match;
					const base64 = body.replace(/\s/g, "");
					// DER keys start with an ASN.1 SEQUENCE, which is "M" followed by A-P in Base64. Placeholders don't.
					if (!/^M[A-P]/.test(base64) || isReportedByPreset(type, body, base64)) {
						continue;
					}
					context.report({
						message: t("PrivateKey", { KEY: key }),
						range: [match.index, match.index + key.length]
					});
				}
			}
		};
	}
};
