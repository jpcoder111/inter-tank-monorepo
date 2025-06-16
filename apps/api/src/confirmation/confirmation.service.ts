import { Injectable } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { FileService } from 'src/file/file.service';
import {
  CONFIRMATION_SYSTEM_PROMPT,
  CONFIRMATION_SCHEMA,
} from './confirmatino.constants';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { OcrService } from 'src/ocr/ocr.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateConfirmationDto } from './dto';
import { z } from 'zod';

@Injectable()
export class ConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly fileService: FileService,
    private readonly ocrService: OcrService,
  ) {}

  async createConfirmation(
    createConfirmationDto: CreateConfirmationDto,
    file: Express.Multer.File,
  ) {
    const { fileRecord: inputFileRecord } = await this.fileService.uploadFile(
      file,
      'confirmation-input',
    );

    const ocrResult = await this.ocrService.extractTextFromPdf(file);
    const confirmationHash = await this.aiService.createMessage(
      ocrResult.text,
      CONFIRMATION_SYSTEM_PROMPT,
      CONFIRMATION_SCHEMA,
    );

    const confirmationPdf = await this.createConfirmationPdf(
      confirmationHash,
      createConfirmationDto,
    );
    const { fileRecord: outputFileRecord } = await this.fileService.uploadFile(
      confirmationPdf,
      'confirmation-output',
    );

    const confirmationRecord = await this.prisma.confirmation.create({
      data: {
        inputFile: {
          connect: {
            id: inputFileRecord.id,
          },
        },
        outputFile: {
          connect: {
            id: outputFileRecord.id,
          },
        },
        shipper: createConfirmationDto.shipper,
        importer: createConfirmationDto.importer,
      },
    });
    return confirmationPdf;
  }

  async createConfirmationPdf(
    confirmationHash: z.infer<typeof CONFIRMATION_SCHEMA>,
    createConfirmationDto: CreateConfirmationDto,
  ) {
    // const hardcodedCreateConfirmationDto = {
    //   customerName: 'Juan Pérez',
    //   customerPhone: '+56 9 1234 5678',
    //   shipper: 'olis',
    //   importer: 'watafa',
    //   ref: 'referyy',
    //   incoterm: 'FBIOPENUP',
    //   isInsulated: false,
    // };
    // const hardcodedConfirmationHash = {
    //   booking_number: '31729186',
    //   vessel: 'CMA CGM JACQUES JOSEPH',
    //   voyage_number: '5212N',
    //   shipping_line: 'HAPAG-LLOYD',
    //   etd: '2025-05-02 06:00',
    //   eta: '2025-05-30 01:00',
    //   pol: 'SAN ANTONIO',
    //   pod: 'LONDON GATEWAY PORT',
    //   depot: 'CONTOPSA SAI',
    //   terminal: 'DP WORLD SAN ANTONIO S.A.',
    //   container_quantity: 1,
    //   container_type: "40'HQ",
    //   container_commodity: 'DG HI TEMP',
    // };

    const pdfBuffer = await this.generatePDF(
      confirmationHash,
      createConfirmationDto,
    );

    const tempFile: Express.Multer.File = {
      fieldname: 'confirmation',
      originalname: `confirmation_${confirmationHash.booking_number}.pdf`,
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
      size: pdfBuffer.length,
    } as Express.Multer.File;

    return tempFile;
  }

  private async generatePDF(
    data: any,
    createConfirmationDto: CreateConfirmationDto,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 42.52 }); // 15mm margins
        const buffers: Buffer[] = [];

        doc.on('data', (buffer) => buffers.push(buffer));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Add header with logo and title
        this.addHeader(doc);

        // Add main content
        this.addMainContent(doc, data, createConfirmationDto);

        // Add important notes page
        this.addImportantNotesPage(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private addHeader(doc: PDFKit.PDFDocument) {
    const logoPath = path.join(__dirname, '../../assets/intertank.jpeg');

    // Add logo at top right
    if (fs.existsSync(logoPath)) {
      doc.image(
        logoPath,
        doc.page.width - doc.page.margins.right - 99.21,
        42.52,
        { width: 99.21 },
      ); // 35mm width
    }

    // Add "generated at" text
    const now = new Date();
    const generatedStr = now
      .toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .replace(/\s/g, '-');

    doc
      .fontSize(9)
      .fillColor('#B4B4B4')
      .font('Helvetica-Oblique')
      .text(
        `Generated at ${generatedStr}`,
        doc.page.width - doc.page.margins.right - 100,
        22.68,
        { align: 'right' },
      );

    // Add main title
    doc
      .fontSize(16)
      .fillColor('#000080')
      .font('Helvetica-Bold')
      .text('INTER-TANK BOOKING CONFIRMATION', 42.52, 28.35);

    // Reset color and move cursor
    doc.fillColor('black');
    doc.y = 70.87; // 25mm from top
  }

  private addMainContent(
    doc: PDFKit.PDFDocument,
    data: any,
    createConfirmationDto: CreateConfirmationDto,
  ) {
    // Add separator line
    doc
      .strokeColor('#C8C8C8')
      .lineWidth(0.5)
      .moveTo(42.52, doc.y)
      .lineTo(doc.page.width - 42.52, doc.y)
      .stroke();

    doc.y += 14.17; // 5mm space

    // Helper function to add sections
    const addSection = (
      title: string,
      fields: Array<[string, string, boolean]>,
    ) => {
      // Section title
      doc
        .fontSize(12)
        .fillColor('#000080')
        .font('Helvetica-Bold')
        .text(title, 42.52, doc.y);

      doc.y += 8;

      // Add separator line
      doc
        .strokeColor('#E6E6E6')
        .lineWidth(0.5)
        .moveTo(42.52, doc.y)
        .lineTo(doc.page.width - 42.52, doc.y)
        .stroke();

      doc.y += 5.67; // 2mm space

      fields.forEach(([label, value, highlight]) => {
        doc
          .fontSize(10)
          .fillColor('black')
          .font('Helvetica-Bold')
          .text(`${label}:`, 42.52, doc.y, { width: 170.08 }); // 60mm width

        doc
          .fillColor(highlight ? 'red' : 'black')
          .font(highlight ? 'Helvetica-Bold' : 'Helvetica')
          .text(value || '-', 212.6, doc.y); // Start after label

        doc.y += 19.84; // 7mm space
      });

      doc.y += 8.5; // 3mm extra space between sections
    };

    const customerName = createConfirmationDto.customerName;
    const customerPhone = createConfirmationDto.customerPhone;
    const shipper = createConfirmationDto.shipper;
    const importer = createConfirmationDto.importer;
    const ref = createConfirmationDto.ref;
    const incoterm = createConfirmationDto.incoterm;
    const insulated = createConfirmationDto.isInsulated;

    addSection('CONTACT', [
      ['Customer', customerName, false],
      ['Email', this.customerEmail(customerName), false],
      ['Phone', customerPhone, false],
    ]);

    addSection('VESSEL DETAILS', [
      ['Shipper', shipper, false],
      ['Importer', importer, false],
      ['REF', ref, false],
      ['Shipping Line', data.shipping_line, false],
      ['Booking Number', data.booking_number?.replace(/\s/g, '') || '', false],
      ['Vessel / Voyage', `${data.vessel} ${data.voyage_number}`, false],
      ['ETD', this.formatDate(data.etd, 'short'), false],
      ['ETA', this.formatDate(data.eta, 'short'), false],
      ['Port of Loading', data.pol, false],
      ['Port of Discharge', data.pod, false],
    ]);

    addSection('CARGO', [
      [
        'Quantity / Container Type',
        `${data.container_quantity || '-'} x ${data.container_type || '-'}`,
        false,
      ],
      ['Commodity', data.container_commodity, false],
      ['Incoterm', incoterm, false],
    ]);

    // Add insulated container notice if needed
    if (insulated) {
      doc
        .fontSize(11)
        .fillColor('black')
        .font('Helvetica-Bold')
        .rect(42.52, doc.y, doc.page.width - 85.04, 28.35)
        .fillAndStroke('#FFFFB4', '#FFFFB4')
        .fillColor('black')
        .text('CONTENEDOR(ES) INSULADO(S)', 42.52, doc.y + 9, {
          align: 'center',
        });

      doc.y += 34.02; // Space after
    }

    addSection('DEPOT & TERMINAL', [
      ['Depot', data.depot || 'POR CONFIRMAR', false],
      ['Terminal', data.terminal, false],
    ]);

    addSection('DEADLINES', [
      ['SI Cut-Off', 'POR CONFIRMAR', false],
      ['Stacking', 'POR CONFIRMAR', false],
    ]);

    // Add footer line
    doc.y += 28.35; // 10mm space
    doc
      .strokeColor('#C8C8C8')
      .lineWidth(0.5)
      .moveTo(42.52, doc.y)
      .lineTo(doc.page.width - 42.52, doc.y)
      .stroke();
  }

  private addImportantNotesPage(doc: PDFKit.PDFDocument) {
    doc.addPage();

    // Add logo at top right
    const logoPath = path.join(__dirname, '../../assets/intertank.jpeg');
    if (fs.existsSync(logoPath)) {
      doc.image(
        logoPath,
        doc.page.width - doc.page.margins.right - 99.21,
        42.52,
        { width: 99.21 },
      );
    }

    doc.y = 70.87; // Start below logo

    // Section title
    doc
      .fontSize(11)
      .fillColor('black')
      .font('Helvetica-Bold')
      .text('NOTAS IMPORTANTES', 42.52, doc.y);

    doc.y += 22.68; // 8mm space

    // Add separator line
    doc
      .strokeColor('#C8C8C8')
      .lineWidth(0.5)
      .moveTo(42.52, doc.y)
      .lineTo(doc.page.width - 42.52, doc.y)
      .stroke();

    doc.y += 5.67; // 2mm space

    // Notes content
    const notes = [
      '- Por favor enviar datos completos de Shipper, Consignee y Notify, según detalle:',
      'Nombre de compañía, Contacto telefónico, RUT, RUC, NIT según corresponda, Email y Dirección.',
      'EORI (solo para carga a Europa)*',
      '',
      '- Al momento de presentar matriz, considerar que debe ser en formato EXCEL o WORD, de lo contrario no serán aceptadas.',
      '- Matriz recibida se considerará como definitiva, por lo que debe incluir: tipo de emisión, contenedor, sello naviera, partida arancelaria, kilos totales, litros totales y M3.',
      '- Matriz posterior a la emisión del draft o integrada por Inter-Tank, estarán afectas a costo por matriz fuera de plazo. Adicional a esto, cualquier modificación posterior a la presentación de matriz, estará afecta a costo por corrección de BL.',
      '- Es responsabilidad del Shipper presentar VGM a naviera.',
      '- Fechas de zarpe y llegadas a destino fueron proporcionadas por naviera al momento de la confirmación de la reserva. Sin perjuicio de lo anterior, son estimadas y pueden variar por distintas circunstancias no atribuibles a Inter-Tank.',
      '',
      "- Dirección retiro BL: General José O'Brien 2376, Vitacura.",
      '',
      'IMPORTANTE',
      '- Favor considerar que unidades Flexitank se deben entregar a puerto dentro de las 24 hrs de realizado el carguío, pasado ese plazo, no será responsabilidad de Inter-Tank, si presentan mermas atribuibles a terceros.',
      '',
      'DIRECCIÓN ARMADO FLEXITANK',
      'Proyecto Bodegas Innova-TF Logistics',
      'Dirección: Camino El Retiro S/N, Puente Alto.',
      'Cómo llegar: https://goo.gl/maps/iWw89BaXetfYrs9u9',
      'Horario de atención: Lunes a jueves 08:00 a 17:30 hrs. | Viernes: 08:00 a 17:00 hrs.',
      '',
      'CONTACTO BODEGA',
      'Patricio Sangmeister',
      'Teléfono: +56 9 2057 0893',
      'Correo: patricio.sangmeister@inter-tank.com',
      '',
      'TIPO DE CAMBIO',
      '- Notar que es considerado de acuerdo al tipo de cambio Inter-Tank que se reajusta cada semana, por lo que no se considera el tipo de cambio de dólar observado del Banco Central.',
      '- Nuestro sistema no generará Draft con numeración y solo una vez recepcionado el pago de costos locales o tarifa negociada, se podrá generar automáticamente el HBL con una numeración.',
    ];

    doc.fontSize(9).fillColor('black').font('Helvetica');

    notes.forEach((line) => {
      if (line.trim() === '') {
        doc.y += 14.17; // 5mm space for empty lines
      } else {
        const textHeight = doc.heightOfString(line, {
          width: doc.page.width - 85.04,
        });
        doc.text(line, 42.52, doc.y, { width: doc.page.width - 85.04 });
        doc.y += textHeight + 2.83; // Small space between lines
      }
    });
  }

  private customerEmail(customerName: string): string {
    return customerName.toLowerCase().split(' ').join('.') + '@inter-tank.com';
  }

  private formatDate(
    dateStr: string,
    type: 'short' | 'long' = 'short',
  ): string {
    if (!dateStr || dateStr === 'null' || dateStr === null) {
      return '-';
    }

    try {
      const date = new Date(dateStr);
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      const day = date.getDate().toString().padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();

      if (type === 'short') {
        return `${day}-${month}-${year}`;
      } else {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${minutes}`;
      }
    } catch (error) {
      return dateStr;
    }
  }
}
