
/**
 * Converts a File object to a base64 encoded string along with its MIME type.
 * @param file - The File object to convert.
 * @returns A promise that resolves to an object with mimeType and base64 data.
 */
export const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      
      const mimeTypeMatch = header.match(/:(.*?);/);
      if (!mimeTypeMatch || !mimeTypeMatch[1]) {
        return reject(new Error("Não foi possível extrair o tipo MIME do arquivo."));
      }
      const mimeType = mimeTypeMatch[1];
      
      resolve({ mimeType, data });
    };
    reader.onerror = (error) => reject(error);
  });
};
