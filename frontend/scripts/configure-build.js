#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get build variant from environment variable or command line argument
const variant = process.env.BUILD_VARIANT || process.argv[2] || 'default';

const wrapperPath = path.join(__dirname, '../app/datasets/components/create-dataset-modal-wrapper.tsx');

let wrapperContent;

if (variant === 'with-mock') {
  console.log('Configuring build for variant: with-mock (mock dataset field is mandatory)');
  wrapperContent = `// This file is auto-configured during build
// Build variant: with-mock
export { CreateDatasetModal } from "./create-dataset-modal-with-mock"
`;
} else {
  console.log('Configuring build for variant: default (no mock dataset field)');
  wrapperContent = `// This file is auto-configured during build
// Build variant: default
export { CreateDatasetModal } from "./create-dataset-modal"
`;
}

fs.writeFileSync(wrapperPath, wrapperContent);
console.log('Build configuration complete!');