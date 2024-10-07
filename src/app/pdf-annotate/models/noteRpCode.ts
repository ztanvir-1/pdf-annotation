export class NoteRpCode {
  guid: string;
  subject: string;
  description: string;
  objectId: string;
  mimetype: string;
  documentBody: string;
  fileName: string;
  partnerUrl: string;
  partnerName:string;

  constructor() {
    this.guid = '';
    this.subject = '';
    this.description = '';
    this.objectId = '';
    this.mimetype = '';
    this.documentBody = '';
    this.fileName = '';
    this.partnerUrl = '';
    this.partnerName = '';
  }
}
