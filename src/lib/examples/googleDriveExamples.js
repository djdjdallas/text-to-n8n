import fs from 'fs';
import path from 'path';

export class GoogleDriveExamples {
  static loadExample() {
    try {
      const examplePath = path.join(process.cwd(), 'docs/n8n/examples/google.drive.json');
      const exampleContent = fs.readFileSync(examplePath, 'utf8');
      return JSON.parse(exampleContent);
    } catch (error) {
      console.error('Failed to load Google Drive example:', error);
      return null;
    }
  }

  static getNodeStructure() {
    const example = this.loadExample();
    if (!example || !example.nodes) return null;
    
    const googleDriveNode = example.nodes.find(n => n.type === 'n8n-nodes-base.googleDrive');
    return googleDriveNode?.parameters || null;
  }

  static validateStructure(nodeParameters) {
    const exampleStructure = this.getNodeStructure();
    if (!exampleStructure) return true; // Can't validate without example
    
    // Check for required fields
    const requiredFields = ['driveId', 'folderId'];
    for (const field of requiredFields) {
      if (!nodeParameters[field] || !nodeParameters[field].__rl) {
        console.warn(`Google Drive node missing required field or __rl structure: ${field}`);
        return false;
      }
    }
    
    return true;
  }
}