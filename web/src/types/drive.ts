export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  webViewLink?: string
}

export interface DriveFolder extends DriveFile {
  mimeType: 'application/vnd.google-apps.folder'
}

export interface FolderStructure {
  id: string
  name: string
  folders: FolderStructure[]
  files: DriveFile[]
  path: string[]
}

