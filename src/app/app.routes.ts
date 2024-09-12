import { Routes } from '@angular/router';
import { PdfAnnotateComponent } from './pdf-annotate/pdf-annotate.component';
import { ExamplePdfViewerComponent } from './example-pdf-viewer/example-pdf-viewer.component';

export const routes: Routes = [
  {path:'upload', component:PdfAnnotateComponent},
  {path:'test', component:ExamplePdfViewerComponent},
  { path: '', redirectTo: 'upload', pathMatch: 'full' },
];
