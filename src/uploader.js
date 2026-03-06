import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "./config.js";

let s3Client = null;

export function initAWS() {
  const { region, accessKeyId, secretAccessKey } = config.aws;

  if (region && accessKeyId && secretAccessKey) {
    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  } else {
    console.warn("AWS credentials not fully configured.");
  }
}

export async function uploadToS3(fileBlob, fileName, folder = 'uploads', albumName = '') {
  if (!s3Client) {
    throw new Error("AWS S3 Client not initialized. Check credentials.");
  }

  const { bucketName } = config.aws;

  // Format the key to include Album Name if provided
  const safeAlbum = albumName ? albumName.trim().replace(/[^a-zA-Z0-9-_@]/g, '_') : '';
  const key = `${folder}/${safeAlbum}/${fileName}`;

  // FIX: AWS SDK v3 in the browser often fails on flexibleChecksumsMiddleware
  // when given a raw File or Blob because it tries to convert it to a chunked stream incorrectly. 
  // We resolve this by converting the Blob into a flat ArrayBuffer (or Uint8Array) first.
  const arrayBuffer = await fileBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: uint8Array,
    ContentType: fileBlob.type,
    // Note: depending on bucket ACLs, you might want ACL: 'public-read'
  });

  try {
    const response = await s3Client.send(command);
    return {
      success: true,
      key,
      url: `https://${bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`,
      response
    };
  } catch (err) {
    console.error("S3 Upload Error:", err);
    throw err;
  }
}
