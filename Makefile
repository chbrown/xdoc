all: typescript

# base64.ts characters.ts datastructures.ts domlib.ts xdom.ts formats/docx.ts
typescript:
	tsc --module amd *.ts formats/*.ts
