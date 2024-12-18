import * as fs from "fs";
import * as path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface CloudConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface FileSystemServiceOptions {
  isCloud?: boolean; // True para entorno de nube, false para local.
  cloudConfig?: CloudConfig; // Configuración para S3.
}

//? Example use:
//? const fileService = new FileSystemService({
//?   isCloud: true,
//?   cloudConfig: {
//?     endpoint: process.env.DO_SPACES_URL!,
//?     region: process.env.DO_SPACES_REGION!,
//?     bucket: process.env.DO_SPACES_BUCKET!,
//?     accessKeyId: process.env.DO_SPACES_ID_KEY!,
//?     secretAccessKey: process.env.DO_SPACES_SECRET_KEY!,
//?   },
//? });

export class FileSystemService {
  private readonly documentPath: string;
  private readonly isCloud: boolean;
  private readonly s3Client?: S3Client;
  private readonly bucket?: string;

  constructor(options?: FileSystemServiceOptions) {
    this.isCloud = options?.isCloud || false;
    this.documentPath = path.join(__dirname, "/../../documents");

    if (this.isCloud) {
      // if (!options?.cloudConfig) throw "S3 undefined";
      // const { endpoint, region, bucket, accessKeyId, secretAccessKey } = options.cloudConfig;
      this.bucket = process.env.DO_SPACES_BUCKET!;

      this.s3Client = new S3Client({
        endpoint: process.env.DO_SPACES_URL!,
        region: process.env.DO_SPACES_REGION!,
        credentials: {
          accessKeyId: process.env.DO_SPACES_ID_KEY!,
          secretAccessKey: process.env.DO_SPACES_SECRET_KEY!,
        },
      });
    } else {
      this.createPath();
    }
  }

  private createPath(): void {
    if (!this.isCloud) {
      this.checkPath(this.documentPath);
    }
  }

  private checkPath(pathName: string): void {
    if (!fs.existsSync(pathName)) {
      fs.mkdirSync(pathName, { recursive: true });
    }
  }

  writeDocumentByCause(pdfArray: number[], subPath: string, filename: string) {
    return this.save(pdfArray, subPath, filename);
  }

  async save(
    pdfArray: number[],
    cause: string,
    filename: string
  ): Promise<void> {
    const buffer = Buffer.from(pdfArray);

    if (this.isCloud) {
      await this.uploadToS3Bucket(cause, filename, buffer);
    } else {
      const localPath = path.join(this.documentPath, cause);
      this.checkPath(localPath);
      fs.writeFileSync(path.join(localPath, `${filename}.pdf`), buffer);
    }
  }

  private async uploadToS3Bucket(
    cause: string,
    fileName: string,
    buffer: Buffer
  ): Promise<void> {
    try {
      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucket!,
          Key: `general-causes/${cause}/${fileName}.pdf`,
          ContentType: "application/pdf",
          Body: buffer,
        })
      );
      console.log("PDF uploaded successfully.");
    } catch (error) {
      console.error("Error uploading PDF:", error);
      throw error;
    }
  }

  async getSignedS3Url(
    input: { fileName: string; cause: string },
    expiresIn: number = 60
  ): Promise<string> {
    if (!this.isCloud) {
      throw new Error("Signed URLs are not supported in local mode.");
    }

    const { fileName, cause } = input;
    const command = new GetObjectCommand({
      Bucket: this.bucket!,
      Key: `general-causes/${cause}/${fileName}`,
    });

    try {
      return await getSignedUrl(this.s3Client!, command, { expiresIn });
    } catch (error) {
      console.error("Error generating signed URL:", error);
      throw error;
    }
  }
}
