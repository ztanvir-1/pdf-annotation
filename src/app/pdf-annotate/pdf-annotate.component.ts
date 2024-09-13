import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxExtendedPdfViewerModule, NgxExtendedPdfViewerService, PDFDocumentProxy } from 'ngx-extended-pdf-viewer';
import { PDFDocument, rgb } from 'pdf-lib'; // Import from pdf-lib

interface annotations{
  x:number,
  y:number,
  page:number,
  text:string,
  type:string,
  id:string,
  fontsize:number,
  fontColor:string
}

@Component({
  selector: 'app-pdf-annotate',
  standalone: true,
  imports: [NgxExtendedPdfViewerModule, FormsModule, CommonModule],
  providers: [NgxExtendedPdfViewerService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-annotate.component.html',
  styleUrl: './pdf-annotate.component.css'
})
export class PdfAnnotateComponent {
  public pdfSrc: string | ArrayBuffer | null = null; // Initially, no PDF is loaded
  public pdfDocument: PDFDocumentProxy | null = null; // Store the PDF document
  private annotations: annotations[] = []; // Store annotation data
  private selectedFile: File | null = null;
  fontsize:number = 12;
  fontColor:string = "#00000";
  scaledHeight:number = 0;
  scaledWidth:number = 0;
  scale:number = 1;
  x:number = 0 ;
  y:number = 0 ;
  id:string = "";

  constructor(private cdr:ChangeDetectorRef) {}
  // Handle file input change
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.pdfSrc = e.target.result; // Set the PDF source to the file's ArrayBuffer
        this.cdr.detectChanges();
      };
      reader.readAsArrayBuffer(file); // Read the PDF file as ArrayBuffer
    } else {
      alert('Please upload a valid PDF file.');
    }
  }

  pdfLoaded(name:string, event:any){
    console.log("pdf loaded: ", event);
  }

  annotationEditorEvent(name:string, event:any){
    console.log('Annotation Editor Event:', event);

    if(event.editorType === "FreeTextEditor"){
      if(event.value && event.source && event.source.x && event.source.y && (event.type == "moved" || event.type == "fontSizeChanged" || event.type == "commit" || event.type == "colorChanged")){
        console.log("x", event.source.x);
        console.log("y", event.source.y);
        if(event.source.pageDimensions && event.source.pageDimensions.length > 0){
          console.log("page width:", event.source.pageDimensions[0]);
          console.log("page height:", event.source.pageDimensions[1]);

          if(event.type == "fontSizeChanged"){
            this.fontsize = event.value;
            console.log("font-size changed to: ", this.fontsize);
          }
          if(event.type && event.type == "colorChanged"){
            this.fontColor = event.value;
            console.log("font-color changed to: ", this.fontColor);
          }
          const annotationId = event.source.id;
          const { x, y } = this.convertToPixelCoordinates(event.source.pageDimensions[0], event.source.pageDimensions[1], event.source.x, event.source.y, (this.fontsize), annotationId);
          // this.annotations.push({ id: event.source.id, page: event.page, x: x, y: y, text: 'Placed Text', type:"text" });
          this.scaledHeight = event.source.height ? event.source.height : 0;
          this.scaledWidth = event.source.width ? event.source.width : 0;
          if(event.source.parent && event.source.parent.viewport)
            this.scale = event.source.parent.viewport.scale;
          // Find the index of the annotation with the same id
          const index = this.annotations.findIndex(annotation => annotation.id === annotationId);
          this.x = x;
          this.y = y;
          this.id = annotationId;

          if (index !== -1) {
            // If the annotation exists, update the existing object
            this.annotations[index] = {
              id: annotationId,
              page: event.page,
              x: x,
              y: y,
              text: 'Placed Text',
              type: "text",
              fontsize:this.fontsize,
              fontColor:this.fontColor
            };
          } else {
            // If it doesn't exist, add the new annotation to the array
            this.annotations.push({
              id: annotationId,
              page: event.page,
              x: x,
              y: y,
              text: 'Placed Text',
              type:"text",
              fontsize:this.fontsize,
              fontColor:this.fontColor
            });
          }
          if(event.source.hasOwnProperty('#Os'))
            this.fontsize = event.source["#Os"];
        }
      }

      if(event.type && event.type == "removed"){
        this.annotations = this.annotations.filter(x=>x.id !== event.source.id)
      }
    }
  }

  // Add text to the PDF at specified coordinates and download it
  async downloadModifiedPdf(): Promise<void> {
    if (!this.selectedFile) {
      alert('Please upload a PDF file first.');
      return;
    }

    // Read the uploaded PDF file
    const fileBuffer = await this.selectedFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(fileBuffer);

    // Modify the PDF by placing text on the specified coordinates
    for (const annotation of this.annotations) {
      const page = pdfDoc.getPage(annotation.page - 1); // Page is 0-indexed in pdf-lib
      // const width = page.getWidth();
      // const height = page.getHeight();
      const rgbColor = this.hexToRgb(annotation.fontColor);
      page.drawText(annotation.text, {
        x:annotation.x,
        y: annotation.y,
        size: annotation.fontsize -1 ,
        color: rgb(rgbColor.r/255, rgbColor.g/255, rgbColor.b/255),
      });
    }

    // Serialize the PDF and create a blob to download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modified.pdf';
    link.click();
  }

  // Convert normalized coordinates (0-1) to pixel coordinates
  convertToPixelCoordinates(pageWidth: number, pageHeight: number, normalizedX: number, normalizedY: number, fontsize:number, id:string): { x: number; y: number } {
    console.log("scaled height: ", this.scaledHeight);
    console.log("page height: ", pageHeight);
    console.log(this.scaledHeight * pageHeight);
    const textboxElement = document.querySelector(`#${id}`); // Example for selecting the annotation
    const height = window.getComputedStyle(textboxElement!).height;
    const paddingTop = window.getComputedStyle(textboxElement!).paddingTop;
    const width = window.getComputedStyle(textboxElement!).paddingLeft;
    const heightVal = parseInt(height, 10) || 0;
    const padding = parseInt(paddingTop, 10) || 0;
    const widthVal = parseInt(width, 10) || 0;
    const x = normalizedX * pageWidth + 2;
    const y = (pageHeight - (normalizedY * pageHeight) - fontsize - 0.5 - (this.scaledHeight * heightVal) / 2);
    return { x, y };
  }

  textLayerRendered(name:string, event:any){
    console.log("text layer rendered:", event);
  }

  annotationLayerRendered(name:string, event:any){
    console.log("Annotation layer rendered:", event);
  }
  hexToRgb(hex: string): { r: number, g: number, b: number } {
    // Remove the hash at the start if it's there
    hex = hex.replace(/^#/, '');

    // Parse the r, g, b values
    let bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    return { r, g, b };
  }
}
