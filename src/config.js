// Global application configuration to allow easy parameterization

export const config = {
  // Image Processing Defaults
  image: {
    webMaxWidth: 1280, //null, //1920, // Optional max width for original image, use null to keep original size
    thumbMaxWidth: 300,     // Max width for thumbnail
    quality: 0.85,          // JPEG/WEBP quality (0 to 1)
  },

  watermarkText: "@Guihgo",

  // UI Strings
  ui: {
    connectText: "Connect MetaMask",
    uploadingText: "Uploading to S3...",
  },

  // AWS S3 Configuration
  // IMPORTANT: For a production app, do NOT hardcode secret keys in the frontend. 
  // Prefer using an AWS Cognito Identity Pool, or generate Pre-signed URLs via a backend.
  // For the sake of this frontend-only test, configure it below.
  aws: {
    region: import.meta.env.VITE_AWS_REGION || "sa-east-1",
    bucketName: import.meta.env.VITE_AWS_BUCKET || "dev.guihgo.studio",
    credentials: {
      "7f159792ceb947e7601c086304d600fc53efedb9b0c0708613f42237fe412793": { /*  keccak256(0xaddress.toLowerCase()) */
        accessKeyId: "AKIAQSHN3IMEODUOVHPV",
        secretAccessKey: "OSbkASFEGEN8EsIHkvDP+366Ku8A5rX/hAdySUJSvgBeyL/k9hW2XHn73VIh5cJuLJ/M6GDbmEa6x1CJlkRBuV2sp6o=",
        externalSeed: "on+8l2X/fMysTfnmm9MBAMSgovVK7V67HcRUSoYOi8fckEKhsnSfmzPdshp4/sQ9vNvPS76sSGdsemH/FK6e3Y7mZ//MIsQ=" //email | subject: Guihgo Studio - external seed
      },
      "90ca04421666e9204369dcce766192f6c2dbdc76171a4ea25c639363a191623d": {
        accessKeyId: "AKIAQSHN3IMEJCJC6PUE",
        secretAccessKey: "200zGhNeNGg9dqENjwODPg0v/D0mgrPRqSTanrh1I1WquIfwNsQAgBLP8rk+gGqGxA14J4f+vXzW0eqbw4b613fW5Vc=",
        externalSeed: "XW5V1U/1EJLapZ9WidIQJoXqJUOxKu8vkxOETdb2Rp6ZgD657XEQUq18Okuxx5Nyv6zq74YCkp+wbr0yvGMEVhvI7hAvAqFZ" //email | subject: Guihgo Studio - external seed
      }
    }
  }
};
