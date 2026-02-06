import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding sample template...');

  const sampleTemplate = await prisma.template.create({
    data: {
      name: 'Sample Basic Template',
      css: `body { font-family: Arial, sans-serif; margin: 20px; } h1 { color: #333; } p { color: #666; }`,
      html: `
        <h1>Hello from Sample Template!</h1>
        <p>This is a basic template for testing purposes.</p>
        <p>Current date: {{date}}</p>
      `,
      createdBy: 'Gemini Agent',
    },
  });

  console.log(`Created sample template with ID: ${sampleTemplate.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
