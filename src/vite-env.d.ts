/// <reference types="vite/client" />

declare module '*.docx?url' {
  const url: string;
  export default url;
}

