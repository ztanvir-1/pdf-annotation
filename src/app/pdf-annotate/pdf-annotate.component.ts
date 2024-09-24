import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxExtendedPdfViewerModule, NgxExtendedPdfViewerService, PDFDocumentProxy } from 'ngx-extended-pdf-viewer';
import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib'; // Import from pdf-lib
import { NoteRpCode } from './models/noteRpCode';

interface annotations{
  x:number,
  y:number,
  page:number,
  text:string,
  type:string,
  id:string,
  fontsize:number,
  fontColor:string,
  logoMaxWidth:number,
  logoMaxHeight:number,
  alignment:string,
  availableWidth:number,
  availableHeight:number,
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
export class PdfAnnotateComponent implements OnInit{
  public pdfSrc: string | ArrayBuffer | null = null; // Initially, no PDF is loaded
  public pdfDocument: PDFDocumentProxy | null = null; // Store the PDF document
  annotations: annotations[] = []; // Store annotation data
  private selectedFile: File | null = null;
  fontsize:number = 10;
  fontColor:string = "#00000";
  scaledHeight:number = 0;
  scaledWidth:number = 0;
  scale:number = 1;
  x:number = 0 ;
  y:number = 0 ;
  id:string = "";
  selectedOption: string = '';
  selectedShape: string = 'square'; // Default selection is 'square'
  public logoFilePath: string = 'assets/images/28267842_7.jpg'; // square
  //public logoFilePath: string = 'assets/images/rect.png'; // rectangle
  //public logoFilePath: string = 'assets/images/circle.png'; // circle

  public logoMaxWidth: number = 100; // Default max width for the logo
  public logoMaxHeight: number = 100; // Default max height for the logo
  alignment:string = "left";
  rpCode:string = "";
  annotationDetails:NoteRpCode = new NoteRpCode();
  textValue = "";
  isLoading: boolean = false;  // Flag to control loader visibility

  constructor(private cdr:ChangeDetectorRef, private pdfViewerService: NgxExtendedPdfViewerService, private httpClient:HttpClient) {}

  ngOnInit(){
    // this.getLogoFromRpCode();
  }

  async getLogoFromRpCode(){
    this.isLoading = true;
    this.httpClient.get<NoteRpCode>('https://crmdev.gridsystems.pk/GRCallApp/AP-test/dynamics-api/api/crm/GetLogoAnnotationByRpCodeName?rpCodeName=' + this.rpCode)
    .subscribe({
      next: (res) => {
        this.isLoading = false;  // Set loading to false after getting response
        if (res) {
          this.annotationDetails = res;
          this.downloadModifiedPdf();
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error fetching logo:', error);
        this.isLoading = false;  // Always set loading to false in error case
        this.cdr.detectChanges();
      }
    });
  }

  onShapeChange(newShape: string): void {
    this.selectedShape = newShape;

    // Update the description based on the selected shape
    if (newShape === 'square') {
      this.logoFilePath = 'assets/images/28267842_7.jpg';
    } else if (newShape === 'circle') {
      this.logoFilePath = 'assets/images/circle.png';
    } else if (newShape === 'rectangle') {
      this.logoFilePath = 'assets/images/rect.png';
    }
  }

  onTextAlignChange(alignment:string){
    debugger;
    this.pdfViewerService.editorFontSize = this.fontsize;
  }

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
      try{
        console.log("file name: ", file.name);
      }
      catch(e){
        console.log("error: ", e);
      }
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

    if(event.editorType === "FreeTextEditor" || (event.source && event.source.name && event.source.name == "freeTextEditor")){
      if(event.value && event.source && event.source.x && event.source.y && (event.type == "moved" || event.type == "fontSizeChanged" || event.type == "commit" || event.type == "colorChanged")){
        console.log("text x", event.source.x);
        console.log("text y", event.source.y);
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
          if ("moved" != event.type && event.type != "fontSizeChanged" && event.type != "colorChanged" && event.value) {
            this.textValue = event.value;
          }
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
          const availableWidth = event.source.width * event.source.pageDimensions[0];
          const availableHeight = event.source.height * event.source.pageDimensions[1];
          if (index !== -1) {
            // If the annotation exists, update the existing object
            // this.annotations[index] = {
            //   id: annotationId,
            //   page: event.page,
            //   x: x,
            //   y: y,
            //   text: 'Placed Text',
            //   type: type,
            //   fontsize:this.fontsize,
            //   fontColor:this.fontColor
            // };

            this.annotations[index].id = annotationId;
            this.annotations[index].page = event.page;
            this.annotations[index].x = x;
            this.annotations[index].y = y;
            if ("moved" != event.type && event.type != "fontSizeChanged" && event.type != "colorChanged") {
              this.annotations[index].text = this.textValue;
            }
            // this.annotations[index].text = this.textValue;
            // this.annotations[index].type = type;
            this.annotations[index].fontsize = this.fontsize;
            this.annotations[index].fontColor = this.fontColor;
            this.annotations[index].alignment = this.alignment;
            this.annotations[index].availableWidth = availableWidth;
            this.annotations[index].availableHeight = availableHeight;
          } else {
            // If it doesn't exist, add the new annotation to the array
            this.annotations.push({
              id: annotationId,
              page: event.page,
              x: x,
              y: y,
              text:"moved" != event.type && event.type != "fontSizeChanged" && event.type != "colorChanged" ? this.textValue : "",
              type:'text',
              fontsize:this.fontsize,
              fontColor:this.fontColor,
              logoMaxHeight:0,
              logoMaxWidth: 0,
              alignment:this.alignment,
              availableWidth: availableWidth,
              availableHeight:availableHeight
            });
          }
        }
      }

      if(event.type && event.type == "removed"){
        this.annotations = this.annotations.filter(x=>x.id !== event.source.id)
      }
    }
    else if (event.editorType === "StampEditor"){
      if(event.value && event.source && (event.source.x!=null || event.source.x!=undefined)  && (event.source.y!=null || event.source.y!=undefined) && (event.type == "moved" || event.type == "sizeChanged")){
        console.log("logo x", event.source.x);
        console.log("logo y", event.source.y);
        if(event.source.pageDimensions && event.source.pageDimensions.length > 0){
          console.log("page width:", event.source.pageDimensions[0]);
          console.log("page height:", event.source.pageDimensions[1]);

          const annotationId = event.source.id;
          this.logoMaxWidth = event.source.width * event.source.pageDimensions[0];
          this.logoMaxHeight = event.source.height * event.source.pageDimensions[1];
          const { x, y } = this.convertToPixesCoordinatesForLogo(event.source.pageDimensions[0], event.source.pageDimensions[1], event.source.x, event.source.y, this.logoMaxHeight);

          const index = this.annotations.findIndex(annotation => annotation.id === annotationId);
          this.x = x;
          this.y = y;
          this.id = annotationId;
          const availableWidth = event.source.width * event.source.pageDimensions[0];
          const availableHeight = event.source.height * event.source.pageDimensions[1];
          if (index !== -1) {
            // If the annotation exists, update the existing object
            // this.annotations[index] = {
            //   id: annotationId,
            //   page: event.page,
            //   x: x,
            //   y: y,
            //   text: 'Placed Text',
            //   type: type,
            //   fontsize:this.fontsize,
            //   fontColor:this.fontColor
            // };

            this.annotations[index].id = annotationId;
            this.annotations[index].page = event.page;
            this.annotations[index].x = x;
            this.annotations[index].y = y;
            this.annotations[index].logoMaxWidth = this.logoMaxWidth;
            this.annotations[index].logoMaxHeight = this.logoMaxHeight;
            this.annotations[index].alignment = this.alignment;
            this.annotations[index].availableWidth = availableWidth;
            this.annotations[index].availableHeight = availableHeight;
          } else {
            // If it doesn't exist, add the new annotation to the array
            this.annotations.push({
              id: annotationId,
              page: event.page,
              x: x,
              y: y,
              text:'',
              type:'logo',
              fontsize:this.fontsize,
              fontColor:this.fontColor,
              logoMaxWidth: this.logoMaxWidth,
              logoMaxHeight: this.logoMaxHeight,
              alignment:this.alignment,
              availableWidth: availableWidth,
              availableHeight:availableHeight
            });
          }
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
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Modify the PDF by placing text on the specified coordinates
    for (const annotation of this.annotations) {
      if ("<url>" === annotation.text.toLowerCase()) {
        annotation.text = this.annotationDetails.partnerUrl;
      }

      const page = pdfDoc.getPage(annotation.page - 1); // Page is 0-indexed in pdf-lib
      // const width = page.getWidth();
      // const height = page.getHeight();

      if(annotation.type == "logo"){
        const availableWidth = annotation.availableWidth || page.getWidth();
        const availableHeight = annotation.availableHeight || page.getHeight();
        await this.addLogoToPdf(pdfDoc, this.logoFilePath, page, annotation.x , annotation.y, annotation.logoMaxWidth, annotation.logoMaxHeight, availableWidth, availableHeight, annotation.alignment);
      }
      else{
        const rgbColor = this.hexToRgb(annotation.fontColor);
         // Calculate text width for center alignment
        const textWidth = helveticaFont.widthOfTextAtSize(annotation.text, annotation.fontsize);
        const pageWidth = page.getWidth(); // Get the width of the current page
        // Adjust the X coordinate to center-align the text
        let alignedCoord = 0;

        const availableWidth = annotation.availableWidth || page.getWidth();
        let adjustedX = annotation.x; // Default left alignment

        if (annotation.alignment === 'center') {
          // Center-align the text relative to availableWidth and annotation.x
          adjustedX = annotation.x + (availableWidth - textWidth) / 2;
        } else if (annotation.alignment === 'right') {
          // Right-align the text relative to availableWidth and annotation.x
          adjustedX = annotation.x + (availableWidth - textWidth);
        }

        page.drawText(annotation.text, {
          x:adjustedX,
          y: annotation.y,
          size: annotation.fontsize,
          font:helveticaFont,
          color: rgb(rgbColor.r/255, rgbColor.g/255, rgbColor.b/255),
        });
      }
    }

    // Serialize the PDF and create a blob to download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modified.pdf';
    link.click();
    this.isLoading =false;
  }

  // Convert normalized coordinates (0-1) to pixel coordinates
  convertToPixelCoordinates(pageWidth: number, pageHeight: number, normalizedX: number, normalizedY: number, fontsize:number, id:string): { x: number; y: number } {
    console.log("scaled height: ", this.scaledHeight);
    console.log("page height: ", pageHeight);
    console.log(this.scaledHeight * pageHeight);
    const textboxElement = document.querySelector(`#${id}`); // Example for selecting the annotation
    const height = window.getComputedStyle(textboxElement!).height;
    const heightVal = parseInt(height, 10) || 0;
    const paddingTop = window.getComputedStyle(textboxElement!).paddingTop;
    const width = window.getComputedStyle(textboxElement!).paddingLeft;
    const padding = parseInt(paddingTop, 10) || 0;
    const widthVal = parseInt(width, 10) || 0;

    const x = normalizedX * pageWidth + 2;
    const y = (pageHeight - (normalizedY * pageHeight) - fontsize - 0.5 - (this.scaledHeight * heightVal) / 2);
    return { x, y };
  }

  convertToPixesCoordinatesForLogo(pageWidth: number, pageHeight: number, normalizedX: number, normalizedY: number, logoHeight:number){
    const x = normalizedX * pageWidth;
    const y = pageHeight - (normalizedY * pageHeight);
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

  onDropdownChange(event:any){

  }

  // Add logo to the PDF at specific coordinates with max width and height
  async addLogoToPdf(
    pdfDoc: PDFDocument,
    logoPath: string,
    page: PDFPage,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    availableWidth:number,
    availableHeight:number,
    alignment:string
  ): Promise<void> {
    // const imageBytes = await fetch(logoPath).then(res => res.arrayBuffer()); // Load the image file
    const imageBytes = this.base64ToArrayBuffer(this.annotationDetails.documentBody);

    let image;
    if (this.getImageTypeFromPath(this.annotationDetails.fileName) === "png") {
      image = await pdfDoc.embedPng(imageBytes); // Embed PNG image
    } else {
      image = await pdfDoc.embedJpg(imageBytes); // Embed JPG image
    }

    // Get the original dimensions of the image
    const { width, height } = image.scale(1);

    // Calculate the aspect ratio
    const aspectRatio = width / height;

    // Initialize final dimensions
    let finalWidth = maxWidth;
    let finalHeight = maxHeight;

    // Adjust dimensions to maintain aspect ratio
    if (width > height) {
      // If the image is wider than taller
      finalWidth = Math.min(maxWidth, width);               // Scale width to maxWidth
      finalHeight = finalWidth / aspectRatio;               // Adjust height to maintain aspect ratio
      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;                            // If height exceeds maxHeight, adjust it
        finalWidth = finalHeight * aspectRatio;             // Adjust width accordingly
      }
    } else {
      // If the image is taller than wider
      finalHeight = Math.min(maxHeight, height);            // Scale height to maxHeight
      finalWidth = finalHeight * aspectRatio;               // Adjust width to maintain aspect ratio
      if (finalWidth > maxWidth) {
        finalWidth = maxWidth;                              // If width exceeds maxWidth, adjust it
        finalHeight = finalWidth / aspectRatio;             // Adjust height accordingly
      }
    }

    let adjustedX = x; // Default left alignment
    if (alignment === 'center') {
      // Center-align the text relative to availableWidth and annotation.x
      adjustedX = x + (availableWidth - finalWidth) / 2;
    } else if (alignment === 'right') {
      // Right-align the text relative to availableWidth and annotation.x
      adjustedX = x + (availableWidth - finalWidth);
    }
    // Draw the logo image on the PDF
    page.drawImage(image, {
      x: adjustedX,
      y: y - finalHeight,
      width: finalWidth,
      height: finalHeight
    });
  }


  getImageTypeFromPath(filePath: string): string | null {
    const extension = filePath.split('.').pop()?.toLowerCase();
    if (extension === 'png') {
      return 'png';
    } else if (extension === 'jpg' || extension === 'jpeg') {
      return 'jpeg';
    }
    return null;
  }

  onAttachmentLoaded(name:string, event:any){
    console.log("on attachment loaded: ", event);
  }

  async addImage(): Promise<void> {
    if (!this.selectedFile) {
      alert('Please upload a PDF file first.');
      return;
    }
    await this.pdfViewerService.addImageToAnnotationLayer({
      urlOrDataUrl: 'assets/images/template_square.png',
      page: 0,
      left: '0%',
      bottom: '0%',
      right: '0%',
      top: '100%',
      rotation: 0
    });
    this.pdfViewerService.switchAnnotationEdtorMode(13);
  }

  base64ToArrayBuffer(base64: string): ArrayBuffer {
    // Decode the Base64 string into a binary string
    const binaryString = window.atob(base64);

    // Create a new ArrayBuffer with the same length as the binary string
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    // Convert binary string to bytes (8-bit integers)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Return the ArrayBuffer
    return bytes.buffer;
  }
  onOutlineLoaded(name:string, event:any){
    console.log("on outline loaded: ", event);
  }
  onLayersEvent(name:string, event:any){
    console.log("layers loaded: ", event);
  }
  thumbnailDrawn(name:string, event:any){
    console.log("thumbnailDrawn loaded: ", event);
  }
  xfaLayerRendered(name:string, event:any){
    console.log("xfaLayerRendered loaded: ", event);
  }
  annotationEditorLayerRendered(name:string, event:any){
    console.log("annotationEditorLayerRendered loaded: ", event);
  }

  // Called when the annotation editor layer is rendered
  onAnnotationEditorLayerRendered(event: any): void {
    // Find all annotations and add click event listeners to them
    const annotationsLayer = document.querySelectorAll('.annotationLayer .annotation');
    annotationsLayer.forEach((annotation: any) => {
      annotation.addEventListener('click', (clickEvent: MouseEvent) => {
        this.onAnnotationClicked(annotation);
      });
    });
  }

  // Method to handle annotation click
  onAnnotationClicked(annotation: HTMLElement): void {
    console.log('Annotation clicked:', annotation);

    // Trigger the annotationEditorEvent
    const annotationId = annotation.getAttribute('data-id');
    const event = { annotationId }; // You can include additional info here if needed
    // this.annotationEditorEvent('editor', event);
  }

  public set editorFontSize(event: Event) {
    const target = event.target as HTMLInputElement;
    const test = this.pdfViewerService.getSerializedAnnotations();
  }
}
