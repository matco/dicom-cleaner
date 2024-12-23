# DICOM cleaner
DICOM cleaner is a web application that helps you removing sensitive information from your DICOM file. In other terms, it allows you to clear some tags (meta-data) of a DICOM file.

At the moment, this web application is working only with Chrome with the flag `--enable-experimental-web-platform-features` (to allow the creation of a worker in "module" mode).

## Caution
DICOM cleaner is not able to clean sensitive data that may be watermarked on the images contained in the DICOM files. DICOM cleaner is only able to clean the meta-data.

DICOM cleaner may not work with your DICOM file because DICOM format has many variants.
