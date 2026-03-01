# Seed Data

This directory is a placeholder. Your submission should include seed data that loads automatically when running `docker compose up`.

## Recommended Public DICOM Datasets

1. **Orthanc Sample Datasets** — Small, ready-to-use test files
   - https://www.orthanc-server.com/download.php (scroll to "Sample DICOM images")

2. **pydicom test files** — Minimal DICOM files for unit testing
   - https://github.com/pydicom/pydicom/tree/main/pydicom/data/test_files

3. **TCIA (The Cancer Imaging Archive)** — Larger, realistic datasets
   - https://www.cancerimagingarchive.net/

## Generating Synthetic Data

You can also generate synthetic DICOM files programmatically using `pydicom`:

```python
import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid
import numpy as np

# Create a minimal DICOM file
ds = Dataset()
ds.PatientName = "DOE^JOHN"
ds.PatientID = "PAT-00001"
ds.StudyDate = "20240315"
ds.Modality = "CT"
ds.StudyDescription = "CT CHEST W CONTRAST"
ds.StudyInstanceUID = generate_uid()
ds.SeriesInstanceUID = generate_uid()
ds.SOPInstanceUID = generate_uid()
ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage
ds.Rows = 512
ds.Columns = 512
ds.BitsAllocated = 16
ds.BitsStored = 12
ds.HighBit = 11
ds.PixelRepresentation = 1
ds.SamplesPerPixel = 1
ds.PhotometricInterpretation = "MONOCHROME2"
ds.PixelData = np.random.randint(-1000, 2000, (512, 512), dtype=np.int16).tobytes()

ds.save_as("synthetic_ct.dcm")
```

> **Never include real patient data in your submission.**
