// https://github.com/microsoft/vscode-vsce/issues/1147
// @ts-ignore
let privateB64 = '-----BEGIN PRIVATE KEY-----\n';
privateB64 += 'ABC\n';
privateB64 += '-----END PRIVATE KEY-----\n';

// @ts-ignore
const description = ` This is some description test

      \`\`\`ini
      key="-----BEGIN PRIVATE KEY-----\\nXXXX\\nXXXX\\n-----END PRIVATE KEY-----"
      \`\`\`

      some other text.
    `;

