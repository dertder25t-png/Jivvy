// ... imports ...

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
// SCOPES: We need full drive access or at least drive.file to create visible folders/files.
// 'https://www.googleapis.com/auth/drive.file' grants access to files created by the app.
// To manage a generic folder we create, drive.file is sufficient if WE created it.
export const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Types for Google Identity Services
declare global {
    interface Window {
        google: any;
    }
}

// Cache for folder IDs to avoid repeated API calls
let folderCache: {
    root: string;
    backups: string;
    assets: string;
    lectures: string;
} | null = null;

/**
 * Initiates the Google Token Flow to get an access token.
 */
export const authenticateGoogleDrive = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.google) {
            reject(new Error('Google Identity Services not loaded'));
            return;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response: any) => {
                if (response.error) {
                    reject(response);
                } else {
                    resolve(response.access_token);
                }
            },
        });

        client.requestAccessToken();
    });
};

/**
 * Ensures the Jivvy folder hierarchy exists in Google Drive.
 * Structure:
 * My Drive/
 *   └── Jivvy/
 *       ├── Backups/
 *       └── Assets/
 *           └── Lectures/
 */
async function ensureDriveHierarchy(accessToken: string) {
    if (folderCache) return folderCache;

    const getOrCreate = async (name: string, parentId?: string): Promise<string> => {
        const qParent = parentId ? `'${parentId}' in parents` : "'root' in parents";
        const query = `name='${name}' and ${qParent} and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const searchData = await searchRes.json();

        if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
        }

        // Create
        const metadata: any = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentId) metadata.parents = [parentId];

        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata),
        });
        const file = await createRes.json();
        return file.id;
    };

    // Build hierarchy sequentially to ensure parents exist
    const rootId = await getOrCreate('Jivvy');
    const backupsId = await getOrCreate('Backups', rootId);
    const assetsId = await getOrCreate('Assets', rootId);
    const lecturesId = await getOrCreate('Lectures', assetsId);

    folderCache = {
        root: rootId,
        backups: backupsId,
        assets: assetsId,
        lectures: lecturesId
    };

    return folderCache;
}

/**
 * Uploads a large asset (Image/PDF) to 'Jivvy/Assets' folder.
 */
export const uploadAssetToDrive = async (accessToken: string, file: File | Blob, filename: string): Promise<{ id: string, webViewLink: string }> => {
    const folders = await ensureDriveHierarchy(accessToken);

    // Check if distinct file exists? Or just create new one? 
    // Usually assets are immutable or unique IDs. Let's just create.
    const metadata = {
        name: filename,
        parents: [folders.assets]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
    const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
    });

    if (!res.ok) throw new Error('Failed to upload asset');
    return await res.json();
};

/**
 * Uploads a text string as a file to 'Jivvy/Assets/Lectures' (for Smart Offloading).
 * Returns the File ID.
 */
export const uploadTextAsset = async (accessToken: string, content: string, filename: string): Promise<string> => {
    const folders = await ensureDriveHierarchy(accessToken);

    // Check existing
    const query = `name='${filename}' and '${folders.lectures}' in parents and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    const existingId = searchData.files?.[0]?.id;

    const metadata: any = {
        name: filename,
        mimeType: 'text/plain',
    };
    if (!existingId) metadata.parents = [folders.lectures];

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'text/plain' }));

    let res;
    if (existingId) {
        res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });
    } else {
        res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });
    }

    if (!res.ok) throw new Error('Failed to upload text asset');
    const data = await res.json();
    return data.id;
};

/**
 * Downloads content of a text asset.
 */
export const downloadTextAsset = async (accessToken: string, fileId: string): Promise<string> => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to download text asset');
    return await res.text();
};


export const uploadBackupToDrive = async (accessToken: string, data: any) => {
    const folders = await ensureDriveHierarchy(accessToken);
    const fileName = 'jivvy_backup.json';
    const fileContent = JSON.stringify(data);
    const fileType = 'application/json';

    // Search specifically inside the Backups folder
    const query = `name='${fileName}' and '${folders.backups}' in parents and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    const existingFile = searchData.files?.[0];

    const metadata: any = {
        name: fileName,
        mimeType: fileType,
    };
    if (!existingFile) {
        metadata.parents = [folders.backups];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([fileContent], { type: fileType }));

    if (existingFile) {
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });
    } else {
        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });
    }
    return { success: true };
};

export const downloadBackupFromDrive = async (accessToken: string) => {
    // Try finding in Backups folder first
    // If not found, fall back to simple name search (migration support)
    let folders: any = null;
    try {
        folders = await ensureDriveHierarchy(accessToken);
    } catch (e) {
        console.warn("Could not ensure hierarchy for download check, falling back to name search", e);
    }

    const fileName = 'jivvy_backup.json';
    let query = `name='${fileName}' and trashed=false`;
    if (folders) {
        // Prioritize the backup folder
        // Actually, let's just search globally for now to find it wherever it is, 
        // but prefer the one in the folder if multiple?
        // Simpler: Just search globally by name. It's unique enough for this user scope.
        query = `name='${fileName}' and trashed=false`;
    }

    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    const existingFile = searchData.files?.[0];

    if (!existingFile) return null;

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`;
    const downloadRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return await downloadRes.json();
};
