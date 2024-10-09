import * as fs from "node:fs";
import path from "node:path";

export class FileSystemService {
  private readonly documentPath = path.join(__dirname, "/../../documents");

  constructor() {
    this.createPath();
  }

  private createPath() {
    this.checkPath(this.documentPath);
  }

  private checkPath(pathName: string) {
    if (!fs.existsSync(pathName)) {
      fs.mkdirSync(pathName, { recursive: true });
    }
  }

  writeDocumentByCause(pdfArray: number[], subPath: string, filename: string) {
    const destination = path.join(this.documentPath, subPath);
    this.checkPath(destination);
    const buff = Buffer.from(pdfArray);
    const filePath = path.join(destination, `${filename}`);
    fs.writeFileSync(filePath, buff);
  }

  save(pdfArray: number[], filename: string) {
    const filePath = `${this.documentPath}/${filename}.pdf`;
    const buffer = Buffer.from(pdfArray);
    fs.writeFileSync(filePath, buffer);
  }

  write(data: Array<any>, document = "civil") {
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(`${document}.document.json`, jsonString);
  }
}
