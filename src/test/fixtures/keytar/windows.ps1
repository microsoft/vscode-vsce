param([ValidateSet('seed', 'snapshot', 'cleanup')][string]$Action)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$service = $env:VSCE_TEST_KEYTAR_SERVICE
if ($service -notmatch '^vsce-test-keytar-[a-f0-9-]+$') {
    throw 'Refusing to access credentials outside the test namespace.'
}

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using FILETIME = System.Runtime.InteropServices.ComTypes.FILETIME;

public static class VsceKeytarFixture {
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

    public class Snapshot {
        public string target;
        public string account;
        public string bytes;
        public uint persistence;
        public int writtenHigh;
        public int writtenLow;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredWrite(ref Credential credential, uint flags);
    [DllImport("advapi32.dll", EntryPoint = "CredEnumerateW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredEnumerate(string filter, uint flags, out uint count, out IntPtr credentials);
    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredDelete(string target, uint type, uint flags);
    [DllImport("advapi32.dll")]
    private static extern void CredFree(IntPtr credentials);

    public static void Seed(string service, string account, string base64) {
        byte[] bytes = Convert.FromBase64String(base64);
        IntPtr blob = Marshal.AllocHGlobal(bytes.Length);
        try {
            Marshal.Copy(bytes, 0, blob, bytes.Length);
            var credential = new Credential {
                Type = 1, TargetName = service + "/" + account, UserName = account,
                CredentialBlobSize = (uint)bytes.Length, CredentialBlob = blob, Persist = 3
            };
            if (!CredWrite(ref credential, 0)) {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
        } finally {
            Marshal.FreeHGlobal(blob);
        }
    }

    public static List<Snapshot> Read(string service) {
        uint count;
        IntPtr credentials;
        var result = new List<Snapshot>();
        if (!CredEnumerate(service + "/*", 0, out count, out credentials)) {
            int error = Marshal.GetLastWin32Error();
            if (error == 1168) {
                return result;
            }
            throw new Win32Exception(error);
        }
        try {
            for (int i = 0; i < count; i++) {
                var credential = (Credential)Marshal.PtrToStructure(
                    Marshal.ReadIntPtr(credentials, i * IntPtr.Size), typeof(Credential));
                var bytes = new byte[credential.CredentialBlobSize];
                Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
                result.Add(new Snapshot {
                    target = credential.TargetName, account = credential.UserName,
                    bytes = Convert.ToBase64String(bytes), persistence = credential.Persist,
                    writtenHigh = credential.LastWritten.dwHighDateTime,
                    writtenLow = credential.LastWritten.dwLowDateTime
                });
            }
        } finally {
            CredFree(credentials);
        }
        return result;
    }

    public static void Cleanup(string service) {
        foreach (var credential in Read(service)) {
            if (!CredDelete(credential.target, 1, 0)) {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
        }
    }
}
'@

switch ($Action) {
    'seed' {
        foreach ($publisher in ($env:VSCE_TEST_KEYTAR_PUBLISHERS | ConvertFrom-Json)) {
            [VsceKeytarFixture]::Seed($service, $publisher.name, $publisher.bytes)
        }
    }
    'snapshot' {
        ConvertTo-Json -InputObject @([VsceKeytarFixture]::Read($service)) -Compress
    }
    'cleanup' {
        [VsceKeytarFixture]::Cleanup($service)
    }
}
