// Read keytar's UTF-8 credentials without constructing a keyring Entry.withTarget,
// which overwrites the target credential even when only used to read a secret.
export const windowsKeytarReadScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using FILETIME = System.Runtime.InteropServices.ComTypes.FILETIME;
using System.Text;

public static class VsceKeytarReader {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public class Publisher {
        public string name;
        public string pat;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);

    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr credentials);

    public static Publisher Read(string service, string account) {
        IntPtr pointer;
        if (!CredRead(service + "/" + account, 1, 0, out pointer)) {
            int error = Marshal.GetLastWin32Error();
            if (error == 1168) {
                return null;
            }
            throw new Win32Exception(error);
        }

        try {
            var credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
            if (!String.Equals(credential.UserName, account, StringComparison.OrdinalIgnoreCase)) {
                throw new InvalidOperationException("The credential account does not match.");
            }
            var secret = new byte[checked((int)credential.CredentialBlobSize)];
            try {
                if (secret.Length > 0) {
                    Marshal.Copy(credential.CredentialBlob, secret, 0, secret.Length);
                }
                return new Publisher {
                    name = credential.UserName,
                    pat = new UTF8Encoding(false, true).GetString(secret)
                };
            } finally {
                Array.Clear(secret, 0, secret.Length);
            }
        } finally {
            CredFree(pointer);
        }
    }
}
'@
$credential = [VsceKeytarReader]::Read($env:VSCE_KEYTAR_SERVICE, $env:VSCE_KEYTAR_ACCOUNT)
if ($null -eq $credential) {
    [Console]::WriteLine('null')
} else {
    ConvertTo-Json -InputObject $credential -Compress
}
`;
