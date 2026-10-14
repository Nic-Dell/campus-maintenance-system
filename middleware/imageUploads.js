const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const db = require('../config/db');

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const createImageParser = (fields, maxFiles) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: maxFiles, fields: 12 },
  fileFilter: (req, file, callback) => {
    if (acceptedMimeTypes.has(file.mimetype)) return callback(null, true);
    return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
}).fields(fields);

function parseWith(parser) {
  return (req, res, next) => parser(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      req.imageUploadError = err.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be 5 MB or smaller.'
        : 'Upload one JPEG, PNG, or WebP image in each image field.';
      return next();
    }
    return next(err);
  });
}

const parseRequestImages = parseWith(createImageParser([{ name: 'report_image', maxCount: 1 }], 1));
const parseStatusImages = parseWith(createImageParser([
  { name: 'before_image', maxCount: 1 },
  { name: 'after_image', maxCount: 1 }
], 2));
const parseProfileImage = parseWith(createImageParser([{ name: 'profile_image', maxCount: 1 }], 1));

function identifyImage(buffer) {
  if (
    buffer.length >= 12 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff &&
    buffer[buffer.length - 2] === 0xff &&
    buffer[buffer.length - 1] === 0xd9
  ) {
    return { extension: '.jpg', mimeType: 'image/jpeg' };
  }
  if (
    buffer.length >= 45 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
    buffer.readUInt32BE(8) === 13 &&
    buffer.toString('ascii', 12, 16) === 'IHDR' &&
    buffer.readUInt32BE(16) > 0 &&
    buffer.readUInt32BE(20) > 0 &&
    buffer.includes(Buffer.from('IEND'))
  ) {
    return { extension: '.png', mimeType: 'image/png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP' &&
    buffer.readUInt32LE(4) + 8 === buffer.length
  ) {
    return { extension: '.webp', mimeType: 'image/webp' };
  }
  return null;
}

async function storeImage(file) {
  const image = identifyImage(file.buffer);
  if (!image || image.mimeType !== file.mimetype) {
    throw new Error('Images must be valid JPEG, PNG, or WebP files.');
  }
  await fs.mkdir(db.uploadsDirectory, { recursive: true });
  const filename = `${crypto.randomUUID()}${image.extension}`;
  await fs.writeFile(path.join(db.uploadsDirectory, filename), file.buffer, { flag: 'wx' });
  return filename;
}

async function removeImages(filenames) {
  await Promise.all(filenames.filter(Boolean).map(async (filename) => {
    try {
      await fs.unlink(path.join(db.uploadsDirectory, filename));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }));
}

function getImageContentType(filename) {
  if (filename.endsWith('.jpg')) return 'image/jpeg';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.webp')) return 'image/webp';
  return null;
}

module.exports = {
  parseRequestImages,
  parseStatusImages,
  parseProfileImage,
  identifyImage,
  storeImage,
  removeImages,
  getImageContentType
};
