# Resources

A curated collection of libraries, tools, standards, and test data to accelerate your development. You are not limited to these — use whatever works.

---

## DICOM Standards & References

| Resource | Description |
|---|---|
| [DICOM Standard Browser](https://dicom.innolitics.com/ciods) | Searchable, browsable DICOM standard — far more usable than the PDF spec |
| [DICOMweb Standard](https://www.dicomstandard.org/using/dicomweb) | Official DICOMweb (STOW-RS, QIDO-RS, WADO-RS) documentation |
| [DICOM Part 18 (DICOMweb)](https://dicom.nema.org/medical/dicom/current/output/html/part18.html) | Full Part 18 spec for web services |
| [DICOM Part 5 (Data Structures)](https://dicom.nema.org/medical/dicom/current/output/html/part05.html) | Data encoding, value representations, transfer syntaxes |

---

## DICOM Parsing Libraries

| Library | Language | Notes |
|---|---|---|
| [pydicom](https://pydicom.github.io/) | Python | Most popular Python DICOM library. Read/write/modify DICOM files. |
| [dcmjs](https://github.com/dcmjs-org/dcmjs) | JavaScript | Pure JS DICOM parser. Works in Node.js and browser. |
| [fo-dicom](https://github.com/fo-dicom/fo-dicom) | C# / .NET | Cross-platform .NET DICOM toolkit |
| [dcm4che](https://github.com/dcm4che/dcm4che) | Java | Mature Java DICOM toolkit (used by DCM4CHEE) |
| [dicom-parser](https://github.com/nicolo-ribaudo/dicom-parser) | Rust | Fast Rust DICOM parser |

---

## DICOM Viewers (Client-Side)

You may use these as a foundation for the diagnostic viewer. We evaluate *integration quality*.

| Viewer | Notes |
|---|---|
| [Cornerstone.js (cornerstone3D)](https://github.com/cornerstonejs/cornerstone3D) | The de facto open-source web DICOM renderer. GPU-accelerated. Handles windowing, scrolling, measurement tools. |
| [OHIF Viewer](https://github.com/OHIF/Viewers) | Full-featured DICOM viewer built on Cornerstone.js. React-based. Has study browser, hanging protocols, measurements. |
| [dwv (DICOM Web Viewer)](https://github.com/ivmartel/dwv) | Lightweight alternative. Pure JS, no WebGL. |
| [Papaya](https://github.com/rii-mango/Papaya) | Neuroimaging-focused viewer. Good for brain MRI display. |

**Recommendation:** OHIF Viewer gives you the most out of the box. Cornerstone.js gives you more control for custom integration.

---

## DICOM Servers (Optional Components)

You may use these as backend components. We evaluate how you *extend and integrate* them.

| Server | Notes |
|---|---|
| [Orthanc](https://www.orthanc-server.com/) | Lightweight, REST-based DICOM server. C++. Has plugins for PostgreSQL, DICOMweb, authorization. Docker image available. |
| [DCM4CHEE](https://github.com/dcm4che/dcm4chee-arc-light) | Enterprise-grade Java DICOM archive. Full DICOMweb support. Docker Compose setup available. |

**Note:** Using Orthanc/DCM4CHEE doesn't exempt you from building the custom services (worklist, reporting, auth, frontend). These are DICOM storage/retrieval backends only.

---

## Test DICOM Data

> **Never use real patient data.** All datasets below are public, anonymized, or synthetic.

| Dataset | Description | Access |
|---|---|---|
| [TCIA (The Cancer Imaging Archive)](https://www.cancerimagingarchive.net/) | Large collection of anonymized cancer imaging datasets (CT, MR, PET) | Free registration required |
| [Orthanc Sample Datasets](https://www.orthanc-server.com/download.php) | Small, pre-packaged DICOM datasets ready for testing | Direct download |
| [RSNA Anonymized Cases](https://www.rsna.org/education/ai-resources-and-training/ai-image-challenge) | Competition datasets with labeled imaging studies | Registration required |
| [OpenNeuro](https://openneuro.org/) | Neuroimaging datasets (brain MRI, fMRI) in DICOM/NIfTI | Open access |
| [dicom-server test data](https://github.com/microsoft/dicom-server/tree/main/docs/dcms) | Microsoft DICOM Server test files | GitHub |
| [pydicom test files](https://github.com/pydicom/pydicom/tree/main/pydicom/data/test_files) | Small set of DICOM test files for unit testing | GitHub |

**Recommended approach for seed data:**
1. Download 2–3 small studies from Orthanc samples for Docker seed data
2. Use pydicom to generate synthetic DICOM files programmatically for unit tests
3. Reference TCIA for realistic larger datasets during development

---

## Frameworks & Libraries (By Language)

### Python
| Library | Use Case |
|---|---|
| FastAPI | REST API framework with auto-generated OpenAPI docs |
| Django REST Framework | Batteries-included REST framework |
| SQLAlchemy / Alembic | ORM and database migrations |
| Celery | Async task processing (thumbnail generation, DICOM parsing) |
| Pydantic | Data validation and settings management |

### TypeScript / Node.js
| Library | Use Case |
|---|---|
| NestJS | Enterprise Node.js framework with decorators, DI, OpenAPI |
| Express + tsoa | Lightweight REST with auto-generated OpenAPI |
| Prisma / TypeORM | Type-safe ORM |
| Bull / BullMQ | Job queue for background processing |

### Go
| Library | Use Case |
|---|---|
| Gin / Echo / Fiber | HTTP frameworks |
| GORM | ORM |
| suyashkumar/dicom | Go DICOM parser |

### Frontend (React/TypeScript recommended)
| Library | Use Case |
|---|---|
| React + Vite | SPA foundation |
| Next.js | Full-stack React framework |
| TanStack Query | Data fetching and caching |
| Zustand / Jotai | Lightweight state management |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Component library |

---

## Infrastructure & DevOps

| Tool | Use Case |
|---|---|
| Docker + Docker Compose | Local development and acceptance test |
| Terraform | Infrastructure as Code (AWS, GCP, Azure) |
| Pulumi | IaC alternative (TypeScript/Python) |
| GitHub Actions | CI/CD pipeline |
| MinIO | S3-compatible object storage for local development |
| PostgreSQL | Recommended relational database |
| Redis | Caching and session management |
| Prometheus + Grafana | Metrics and dashboards |
| OpenTelemetry | Distributed tracing |

---

## Useful Reading

| Topic | Resource |
|---|---|
| DICOMweb tutorial | [DICOMweb Primer (OHIF)](https://docs.ohif.org/platform/services/data/DicomMetadataStore) |
| PACS architecture patterns | Search for "cloud-native PACS architecture" — several good whitepapers exist |
| Medical imaging in the cloud | [AWS DICOM implementation guide](https://docs.aws.amazon.com/healthimaging/latest/devguide/what-is.html) |
| Radiology reporting standards | [RSNA RadReport](https://radreport.org/) — standardized report templates |
| HIPAA for developers | [HHS HIPAA Security Rule guidance](https://www.hhs.gov/hipaa/for-professionals/security/index.html) |
