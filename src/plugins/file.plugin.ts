import * as fs from "node:fs";

export class FileSystemService {
  private readonly documentPath = "documents/";

  constructor() {
    this.createPath();
  }

  private createPath() {
    if (!fs.existsSync(this.documentPath)) {
      fs.mkdirSync(this.documentPath);
    }
  }

  save(pdfArray: number[], filename: string) {
    const filePath = `${this.documentPath}/${filename}.pdf`;
    const buffer = Buffer.from(pdfArray);
    fs.writeFileSync(filePath, buffer);
    console.log(`Document <${filename}> writed`);
  }

  write(data: Array<any>, document = "civil") {
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(`${document}.document.json`, jsonString);
  }
}
