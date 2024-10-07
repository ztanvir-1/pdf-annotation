import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, Renderer2, RendererFactory2, ViewChild, effect} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EditorAnnotation, FreeTextEditorAnnotation, IPDFViewerApplication, NgxExtendedPdfViewerModule, NgxExtendedPdfViewerService, PDFDocumentProxy, PDFNotificationService } from 'ngx-extended-pdf-viewer';
import { PDFArray, PDFDocument, PDFHexString, PDFName, PDFPage, PDFString, StandardFonts, rectangle, rgb } from 'pdf-lib'; // Import from pdf-lib
import { NoteRpCode } from './models/noteRpCode';
import { pdfDefaultOptions } from 'ngx-extended-pdf-viewer';
import { LinkTarget } from 'ngx-extended-pdf-viewer';
import { QrCodeGeneratorService } from '../../services/qr-service/qr-service.service';


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
  verticalAlignment:string,
  availableWidth:number,
  availableHeight:number,

  rectX:number,
  rectY:number,
  rectWidth:number,
  rectHeight:number,

  pageNumber:number
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
  verticalAlignment:string = "top";
  rpCode:string = "";
  annotationDetails:NoteRpCode = new NoteRpCode();
  textValue = "";
  isLoading: boolean = false;  // Flag to control loader visibility
  pdfEditorEventSource:string | null  = null;
  annotation:annotations | undefined = undefined;
  private PDFViewerApplication?: IPDFViewerApplication;

  public pdfWidth: number = 0;  // Store PDF width
  public pdfHeight: number = 0; // Store PDF height
  public gridRows: number[] = [];  // Create rows for the grid
  public gridCols: number[] = [];  // Create columns for the grid

  gridEnabled = true;  // By default, the grid is disabled
  showEnableGridToggle = true;
  gridWidth:number = 30;
  currentPageWidth: any;
  currentPageHeight: any;
  selectedAnnotationIds: any[] = [];
  showOptions: boolean = false;

  constructor(private cdr:ChangeDetectorRef, private pdfViewerService: NgxExtendedPdfViewerService, private httpClient:HttpClient, private renderer: Renderer2, private rendererFactory :RendererFactory2, private notificationService: PDFNotificationService, private qrService:QrCodeGeneratorService, private el: ElementRef) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    effect(() => {
      this.PDFViewerApplication = notificationService.onPDFJSInitSignal();
    });
  }

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

  onTextAlignChange(source:string, alignment:string){
    debugger;
    this.pdfEditorEventSource = source;
    if(source == 'ha'){
      this.alignment = alignment;
      this.pdfViewerService.editorFontSize = 10;
    }
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
    pdfDefaultOptions.externalLinkTarget = LinkTarget.BLANK;
  }

  pdfLoaded(name:string, event:any){
    console.log("pdf loaded: ", event);
    this.showOptions = true;
  }

  annotationEditorEvent(name:string, event:any){
    console.log('Annotation Editor Event:', event);
    if(this.pdfEditorEventSource == "ha"){
      const annotationId = event.source.id;
      this.annotation = this.annotations.find(x=>x.id == annotationId);
      if(this.annotation){
        this.annotation.alignment = this.alignment;
      }
      this.pdfEditorEventSource = null;
      this.pdfViewerService.editorFontSize = this.annotation!.fontsize;
      // this.pdfViewerService.editorFontColor = this.annotation!.fontColor;
    }
    else if(this.pdfEditorEventSource && this.pdfEditorEventSource == "xcoord" && event.type != "removed"){
      const annotationId = event.source.id;
      this.annotation = this.annotations.find(x=>x.id == annotationId);
      // remove annotations
      const filter = (serial: any) =>
      serial?.annotationType === 3 &&
      serial?.pageIndex === this.annotation!.pageNumber - 1 ;
      this.pdfViewerService.removeEditorAnnotations(filter);
      // redraw annotation
      this.drawAnnotations(annotationId);
      this.pdfEditorEventSource = null;
      this.textValue = this.annotation!.text;
      //this.pdfViewerService.editorFontSize = annotation!.fontsize;
    }
    else if(this.pdfEditorEventSource == null || this.pdfEditorEventSource == 'va'){
      this.setAnnotationsList(event);
    }
  }

  drawAnnotations(annotationId:string){
    for(let annotation of this.annotations){
      let color = this.hexToRgb(annotation.fontColor);
      const textEditorAnnotation: FreeTextEditorAnnotation = {
          annotationType: 3,
          color: [color.r/255, color.g/255, color.b/255],
          fontSize: annotation.fontsize,
          value: annotation.text,
          pageIndex: 0,
          rect: [
            annotation.rectHeight, // height?
            annotation.rectY, // y
            annotation.rectX, // x
            annotation.rectWidth, // width?
          ],
          rotation: 0,
        };
        this.pdfViewerService.addEditorAnnotation(textEditorAnnotation);
    }
  }

  setAnnotationsList(event:any){
    let latestSerializedAnnotation:EditorAnnotation | null | undefined = null;
    let serializedAnnotations:EditorAnnotation[] | null | undefined = this.pdfViewerService.getSerializedAnnotations();
    if (serializedAnnotations && serializedAnnotations.length > 0)
      latestSerializedAnnotation = serializedAnnotations[serializedAnnotations.length - 1];

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
          const pageNumber = event.page;
          if (index !== -1) {
            this.annotations[index].id = annotationId;
            this.annotations[index].page = event.page;
            this.annotations[index].x = x;
            this.annotations[index].y = y;

            if("moved" != event.type && event.type != "fontSizeChanged" && event.type != "colorChanged"){
              this.annotations[index].text = this.textValue;
            }
            this.annotations[index].fontsize = this.fontsize;
            if(event.type && event.type == "colorChanged"){
              this.annotations[index].fontColor = this.fontColor;
            }
            this.annotations[index].alignment = this.alignment;
            this.annotations[index].verticalAlignment = this.verticalAlignment;
            this.annotations[index].availableWidth = availableWidth;
            this.annotations[index].availableHeight = availableHeight;

            if(latestSerializedAnnotation && latestSerializedAnnotation.rect.length > 0){
              this.annotations[index].rectHeight = !this.annotations[index]?.rectHeight ? latestSerializedAnnotation.rect[0] ? latestSerializedAnnotation.rect[0] : 0 : this.annotations[index].rectHeight;
              this.annotations[index].rectY = !this.annotations[index]?.rectY ? latestSerializedAnnotation.rect[1] ? latestSerializedAnnotation.rect[1] : 0 : this.annotations[index].rectY;
              this.annotations[index].rectX = !this.annotations[index]?.rectX ? latestSerializedAnnotation.rect[2] ? latestSerializedAnnotation.rect[2] : 0 : this.annotations[index].rectX;
              this.annotations[index].rectWidth = !this.annotations[index]?.rectWidth ? latestSerializedAnnotation.rect[3] ? latestSerializedAnnotation.rect[3] : 0 : this.annotations[index].rectWidth;
            }

            this.annotations[index].pageNumber = pageNumber

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
              verticalAlignment:this.verticalAlignment,
              availableWidth: availableWidth,
              availableHeight:availableHeight,
              rectHeight: latestSerializedAnnotation!.rect[0] ? latestSerializedAnnotation!.rect[0] : 0,
              rectY: latestSerializedAnnotation!.rect[1] ? latestSerializedAnnotation!.rect[1] : 0,
              rectX: latestSerializedAnnotation!.rect[2] ? latestSerializedAnnotation!.rect[2] : 0,
              rectWidth: latestSerializedAnnotation!.rect[3] ? latestSerializedAnnotation!.rect[3] : 0,
              pageNumber: pageNumber
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
          const pageNumber = event.page;
          if (index !== -1) {
            this.annotations[index].id = annotationId;
            this.annotations[index].page = event.page;
            this.annotations[index].x = x;
            this.annotations[index].y = y;
            this.annotations[index].logoMaxWidth = this.logoMaxWidth;
            this.annotations[index].logoMaxHeight = this.logoMaxHeight;
            this.annotations[index].alignment = this.alignment;
            this.annotations[index].verticalAlignment = this.verticalAlignment;
            this.annotations[index].availableWidth = availableWidth;
            this.annotations[index].availableHeight = availableHeight;
            if(latestSerializedAnnotation && latestSerializedAnnotation.rect.length > 0){
              this.annotations[index].rectHeight = !this.annotations[index]?.rectHeight ? latestSerializedAnnotation.rect[0] ? latestSerializedAnnotation.rect[0] : 0 : this.annotations[index].rectHeight;
              this.annotations[index].rectY = !this.annotations[index]?.rectY ? latestSerializedAnnotation.rect[1] ? latestSerializedAnnotation.rect[1] : 0 : this.annotations[index].rectY;
              this.annotations[index].rectX = !this.annotations[index]?.rectX ? latestSerializedAnnotation.rect[2] ? latestSerializedAnnotation.rect[2] : 0 : this.annotations[index].rectX;
              this.annotations[index].rectWidth = !this.annotations[index]?.rectWidth ? latestSerializedAnnotation.rect[3] ? latestSerializedAnnotation.rect[3] : 0 : this.annotations[index].rectWidth;
            }
            this.annotations[index].pageNumber = pageNumber

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
      let textToDraw:string = "";
      if ("<url>" === annotation.text.toLowerCase()) {
        textToDraw = this.annotationDetails.partnerUrl;
      }
      else if("<name>" == annotation.text.toLowerCase()){
        textToDraw = "this is going be partner's name";
      }
      else{
        textToDraw = annotation.text;
      }

      const page = pdfDoc.getPage(annotation.page - 1); // Page is 0-indexed in pdf-lib

      if(annotation.type == "logo" || annotation.type == "qr"){
        const availableWidth = annotation.availableWidth || page.getWidth();
        const availableHeight = annotation.availableHeight || page.getHeight();
        await this.addLogoToPdf(pdfDoc, page, annotation.x , annotation.y, annotation.logoMaxWidth, annotation.logoMaxHeight, availableWidth, availableHeight, annotation.alignment, annotation.verticalAlignment, annotation.type);
      }
      else{
        const rgbColor = this.hexToRgb(annotation.fontColor);
         // Calculate text width for center alignment
        const textWidth = helveticaFont.widthOfTextAtSize(textToDraw, annotation.fontsize);
        const textHeight = helveticaFont.heightAtSize(annotation.fontsize); // Text height for vertical alignment
        const pageWidth = page.getWidth(); // Get the width of the current page
        // Adjust the X coordinate to center-align the text

        const availableWidth = annotation.availableWidth || page.getWidth();
        const availableHeight = annotation.availableHeight || page.getHeight();

        let adjustedX = annotation.x; // Default left alignment
        if (annotation.alignment === 'center') {
          // Center-align the text relative to availableWidth and annotation.x
          adjustedX = annotation.x + (availableWidth - textWidth) / 2;
        } else if (annotation.alignment === 'right') {
          // Right-align the text relative to availableWidth and annotation.x
          adjustedX = annotation.x + (availableWidth - textWidth);
        }

        page.drawText(textToDraw, {
          x:adjustedX,
          y: annotation.y,
          size: annotation.fontsize,
          font:helveticaFont,
          color: rgb(rgbColor.r/255, rgbColor.g/255, rgbColor.b/255),
        });

        if("<url>" === annotation.text.toLowerCase()){
            // Create the clickable link annotation using PDF objects
          let link = textToDraw;
          if(!link.includes("http")){
            link = "https://" + link;
          }
          const linkAnnotation = pdfDoc.context.obj({
            Type: PDFName.of('Annot'),
            Subtype: PDFName.of('Link'),
            Rect: [adjustedX, annotation.y, adjustedX + textWidth, annotation.y + textHeight], // Clickable area
            Border: [0, 0, 0], // No border
            A: pdfDoc.context.obj({
              Type: PDFName.of('Action'),
              S: PDFName.of('URI'),
              URI: PDFString.of(link), // The URL to navigate to when clicked
            }),
          });

          // Get existing annotations or create a new array if none exist
          const annotations = page.node.get(PDFName.of('Annots')) as PDFArray | undefined;

          if (annotations) {
            // Append the new annotation if there are existing ones
            annotations.push(linkAnnotation);
          } else {
            // Create a new annotations array and add the link annotation
            const newAnnotations = pdfDoc.context.obj([linkAnnotation]);
            page.node.set(PDFName.of('Annots'), newAnnotations);
          }
        }
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
    page: PDFPage,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    availableWidth:number,
    availableHeight:number,
    alignment:string,
    verticalAlignment:string,
    type:string
  ): Promise<void> {
    // const imageBytes = await fetch(logoPath).then(res => res.arrayBuffer()); // Load the image file
    let imageBytes:ArrayBuffer;
    if(type == "qr"){
      const qrBase64:string = await this.qrService.generateQrCode(this.annotationDetails.partnerUrl);
      imageBytes = this.base64ToArrayBuffer(qrBase64);
    }
    else{
     imageBytes = this.base64ToArrayBuffer(this.annotationDetails.documentBody);
    }

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

    let adjustedY = y; // Default top alignment
    if (verticalAlignment === 'center') {
      // Center-align the text relative to availableWidth and annotation.x
      adjustedY = (y-finalHeight) - (availableHeight - finalHeight) / 2;
    } else if (verticalAlignment === 'bottom') {
      // Bottom-align the text relative to availableWidth and annotation.x
      adjustedY = y - (availableHeight - finalHeight);
    }
    // Draw the logo image on the PDF
    page.drawImage(image, {
      x: adjustedX,
      y: adjustedY - finalHeight,
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

  async addImage(src:string): Promise<void> {

    if (!this.selectedFile) {
      alert('Please upload a PDF file first.');
      return;
    }
    let dataUrl:string = 'assets/images/template_square.png';
    if(src == 'qr'){
      dataUrl = 'assets/images/templare_square_qr.png';
    }
    await this.pdfViewerService.addImageToAnnotationLayer({
      urlOrDataUrl: dataUrl,
      page: 0,
      left: '0%',
      bottom: '0%',
      right: '0%',
      top: '100%',
      rotation: 0
    });
    this.pdfViewerService.switchAnnotationEdtorMode(13);
    const latestAnnotationObject = this.getAnnotationsOnPage();
    this.addImageAnnotationsToList(latestAnnotationObject, src);
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
    if(event && event.source && event.source.viewport && event.source.viewport.viewBox && event.source.viewport.viewBox.length > 0){
      this.currentPageWidth = event.source.viewport.viewBox[2];
      this. currentPageHeight = event.source.viewport.viewBox[3];
      this.addGridOverlayToPages(this.currentPageWidth, this.currentPageHeight);
    }
  }

  onCoordinatesChange(source:string, annotation:annotations){
     // remove annotation
    this.annotation = annotation;
    this.pdfEditorEventSource = null;
    this.pdfEditorEventSource = source;
    this.pdfViewerService.editorFontSize = annotation!.fontsize;
    // this.pdfViewerService.editorFontSize = 10;
    this.annotations = this.annotations.filter(x=>x.id!=annotation.id);
  }

  getAnnotationsOnPage(): Object | null | undefined {
    const pdf: PDFDocumentProxy | undefined = this.PDFViewerApplication?.pdfDocument;
    const annotationsList = pdf?.annotationStorage.getAll();

    // Check if annotationsList exists and has any values
    if (annotationsList && Object.keys(annotationsList).length > 0) {
        // Extract the values from the annotationsList object
        const annotationsArray = Object.values(annotationsList);

        // Assuming the "latest" annotation is the last one in the object
        const latestAnnotation = annotationsArray[annotationsArray.length - 1];

        console.log("Latest Annotation:", latestAnnotation);
        return latestAnnotation;
    }

    console.log("No annotations available.");
    return null;
  }
  addImageAnnotationsToList(eventSource:any, type:string){
    let latestSerializedAnnotation:EditorAnnotation | null | undefined = null;
    let serializedAnnotations:EditorAnnotation[] | null | undefined = this.pdfViewerService.getSerializedAnnotations();
    if (serializedAnnotations && serializedAnnotations.length > 0) {
      latestSerializedAnnotation = serializedAnnotations[serializedAnnotations.length - 1];
    if((eventSource.x!=null || eventSource.x!=undefined)  && (eventSource.y!=null || eventSource.y!=undefined)){
      if(eventSource.pageDimensions && eventSource.pageDimensions.length > 0){
        const annotationId = eventSource.id;
        this.logoMaxWidth = eventSource.width * eventSource.pageDimensions[0];
        this.logoMaxHeight = eventSource.height * eventSource.pageDimensions[1];
        const { x, y } = this.convertToPixesCoordinatesForLogo(eventSource.pageDimensions[0], eventSource.pageDimensions[1], eventSource.x, eventSource.y, this.logoMaxHeight);

        this.x = x;
        this.y = y;
        this.id = annotationId;
        const availableWidth = eventSource.width * eventSource.pageDimensions[0];
        const availableHeight = eventSource.height * eventSource.pageDimensions[1];
        const pageNumber = eventSource.pageIndex;
        // If it doesn't exist, add the new annotation to the array
        this.annotations.push({
          id: annotationId,
          page: pageNumber + 1,
          x: x,
          y: y,
          text:'',
          type:type,
          fontsize:this.fontsize,
          fontColor:this.fontColor,
          logoMaxWidth: this.logoMaxWidth,
          logoMaxHeight: this.logoMaxHeight,
          alignment:this.alignment,
          verticalAlignment:this.verticalAlignment,
          availableWidth: availableWidth,
          availableHeight:availableHeight,
          rectHeight:  latestSerializedAnnotation.rect[0] ? latestSerializedAnnotation.rect[0] : 0,
          rectY: latestSerializedAnnotation.rect[1] ? latestSerializedAnnotation.rect[1] : 0,
          rectX: latestSerializedAnnotation.rect[2] ? latestSerializedAnnotation.rect[2] : 0,
          rectWidth: latestSerializedAnnotation.rect[3] ? latestSerializedAnnotation.rect[3] : 0,
          pageNumber:pageNumber
        });

        this.cdr.detectChanges();
      }
    }
  }
  }

  // this method will be used to draw annotations on pdf using the object retrieved from the db
  async drawAllAnnotations(){
    this.annotations.push({
      alignment:"left",
      availableHeight: 0,
      availableWidth: 0,
      fontColor: "",
      fontsize: 10,
      id: "dsod",
      logoMaxHeight: 0,
      logoMaxWidth: 0,
      page:1,
      pageNumber: 1,
      rectHeight: 8.3357452966714921,
      rectWidth: 637.665329990203,
      rectX: 224.33574529667153,
      rectY: 421.69354542428652,
      text: "",
      type:"logo",
      verticalAlignment:"top",
      x:0,
      y:0
    })

    this.annotations.push({
      alignment:"left",
      availableHeight: 0,
      availableWidth: 0,
      fontColor: "#000000",
      fontsize: 10,
      id: "dsod",
      logoMaxHeight: 0,
      logoMaxWidth: 0,
      page:1,
      pageNumber: 1,
      rectHeight:250.505076003394381,
      rectWidth: 378.32260099584425,
      rectX: 288.201561626397563,
      rectY: 359.355483816320432,
      text: "test text",
      type:"text",
      verticalAlignment:"top",
      x:0,
      y:0
    })

    for(let annotation of this.annotations){
      if(annotation.type == "logo" || annotation.type == "qr"){
        let dataUrl:string = 'assets/images/template_square.png';
        if(annotation.type == 'qr'){
          dataUrl = 'assets/images/templare_square_qr.png';
        }
        await this.pdfViewerService.addImageToAnnotationLayer({
          urlOrDataUrl: dataUrl,
          page: annotation.page - 1,
          left: annotation.rectHeight,
          bottom: annotation.rectY,
          right: annotation.rectX,
          top: annotation.rectWidth,
          rotation: 0
        });
        this.pdfViewerService.switchAnnotationEdtorMode(13);
      }
      else{
        let color = this.hexToRgb(annotation.fontColor);
        const textEditorAnnotation: FreeTextEditorAnnotation = {
            annotationType: 3,
            color: [color.r/255, color.g/255, color.b/255],
            fontSize: annotation.fontsize,
            value: annotation.text,
            pageIndex: 0,
            rect: [
              annotation.rectHeight, // height?
              annotation.rectY, // y
              annotation.rectX, // x
              annotation.rectWidth, // width?
            ],
            rotation: 0,
          };
          this.pdfViewerService.addEditorAnnotation(textEditorAnnotation);
      }
    }
  }

  addGridOverlayToPages(pageWidth: number, pageHeight: number): void {
    // Wait for the PDF to load
    this.isLoading = true;
    setTimeout(() => {
      if(this.gridWidth >= 10 && this.gridWidth <= 100){
        // Get the parent div with the attributes data-l10n-id="pdfjs-page-landmark" and data-page-number="1"
        const targetDiv = document.querySelector('[data-l10n-id="pdfjs-page-landmark"][data-page-number="1"]');

        // Check if the target div exists
        if (targetDiv) {
          // Get the width and height from the target div
          const computedStyles = window.getComputedStyle(targetDiv);
          const width = computedStyles.getPropertyValue('width');
          const height = computedStyles.getPropertyValue('height');

          // Iterate over all children with data-l10n-id="pdfjs-page-landmark"
          const pages = document.querySelectorAll('[data-l10n-id="pdfjs-page-landmark"]');

          pages.forEach((page: Element) => {
            const pageNumber = page.getAttribute('data-page-number');

            if (pageNumber) {
              // Check if an annotationLayer div without the hidden attribute exists
              const existingAnnotationLayer = page.querySelector('.annotationLayer:not([hidden])');

              // If a visible annotationLayer exists, remove it
              if (existingAnnotationLayer) {
                existingAnnotationLayer.remove();
              }

              // Create a new annotationLayer div
              const annotationLayer = document.createElement('div');
              annotationLayer.classList.add('annotationLayer');

              // Apply the width and height from the target div (data-page-number="1")
              annotationLayer.style.width = width;
              annotationLayer.style.height = height;

              // Ensure the annotationLayer has display: grid
              if(this.gridEnabled)
                annotationLayer.style.display = 'grid';
              else
                annotationLayer.style.display = 'none';

              // Create a grid inside the annotationLayer
              this.createGridInAnnotationLayer(annotationLayer, this.gridWidth, pageWidth, pageHeight); // 50px grid cells

              // Append the annotationLayer to the page div
              page.appendChild(annotationLayer);
            }
          });
        }
      }
      this.isLoading = false;
      this.cdr.detectChanges()
    }, 1000);  // Delay to ensure PDF is fully loaded
  }

  createGridInAnnotationLayer(annotationLayer: HTMLElement, cellSize: number, pageWidth: number, pageHeight: number): void {
   // Calculate the number of rows and columns based on the PDF page dimensions
    const numRows = Math.floor(pageHeight / cellSize);
    const numCols = Math.floor(pageWidth / cellSize);

    // Set grid-template-rows and grid-template-columns dynamically based on the calculated rows and columns
    annotationLayer.style.gridTemplateRows = `repeat(${numRows}, 1fr)`;
    annotationLayer.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;

    // Create grid cells and append them to the annotationLayer
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const gridCell = document.createElement('div');
         // Apply inline styles to create dashed borders without overlapping
         gridCell.style.borderTop = "1px dashed black"; // Only top border
         gridCell.style.borderLeft = "1px dashed black"; // Only left border

         // Prevent double borders by applying border only to specific sides
         if (row === numRows - 1) {
           gridCell.style.borderBottom = "1px dashed black"; // Add bottom border for the last row
         }

         if (col === numCols - 1) {
           gridCell.style.borderRight = "1px dashed black"; // Add right border for the last column
         }
        gridCell.classList.add('grid-cell');
        annotationLayer.appendChild(gridCell);
      }
    }
  }

  toggleGrid(): void {
    // Get all divs inside #viewer where data-l10n-id="pdfjs-page-landmark"
    const landmarkDivs = document.querySelectorAll('#viewer [data-l10n-id="pdfjs-page-landmark"]');

    // Iterate through each landmark div and toggle the visibility of the annotationLayer
    landmarkDivs.forEach((landmarkDiv) => {
      // Only select the annotationLayer that does not have the 'disabled' attribute
      const annotationLayer = landmarkDiv.querySelector('.annotationLayer:not([hidden])') as HTMLElement;

      if (annotationLayer) {
        // Toggle the visibility of the annotationLayer
        annotationLayer.style.display = this.gridEnabled ? 'grid' : 'none';
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      this.selectDivWithEditToolbar(event.key);
    }
  }

  selectDivWithEditToolbar(key: string): void {
    this.selectedAnnotationIds = [];
    const allDivs = this.el.nativeElement.querySelectorAll('div.draggable');
    var selectedAnnotation: any = [];
    allDivs.forEach((div: HTMLElement) => {
      const editToolbar = div.querySelector('div.editToolbar');
      if (editToolbar && !editToolbar.classList.contains('hidden')) {
        selectedAnnotation.push(div);
      }
    });

    if (selectedAnnotation && selectedAnnotation.length > 0) {
      selectedAnnotation.forEach((ant: any) => {
        if ("click" === key) {
          if (ant.id) {
            this.selectedAnnotationIds.push(ant.id);
          }
        } else {
          this.updateCoordinatesOnKeyboardClick(ant.id, key);
        }
      });
    } else {
      this.selectedAnnotationIds = [];
    }
  }

  updateCoordinatesOnKeyboardClick(id: string, key: string) {
    if(id){
      const index = this.annotations.findIndex(annotation => annotation.id == id);
      if (index !== -1) {
        if (key === 'ArrowUp')
        this.annotations[index].y += 1;
        else if (key === 'ArrowDown') {
          this.annotations[index].y -= 1;
        } else if (key === 'ArrowLeft') {
          this.annotations[index].x -= 1;
        } else if (key === 'ArrowRight') {
          this.annotations[index].x += 1;
        }
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    this.selectDivWithEditToolbar("click");
    console.log('Selected Annotations:', this.selectedAnnotationIds);
  }
  // checkIfAnnotationSelected(annotationId:string):boolean{
  //   return this.annotations.some(annotation => annotation.id === annotationId);
  // }
  checkIfAnnotationSelected (id: string) {
    var isSelected = false;
    this.selectedAnnotationIds.forEach((ant: any) => {
      if (ant === id) {
        isSelected =  true;
      }
    });
    return isSelected;
  }
}
