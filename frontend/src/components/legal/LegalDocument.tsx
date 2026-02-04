import { LegalDocument as LegalDocumentType } from '../../content/legalContent'

interface LegalDocumentProps {
  document: LegalDocumentType
}

export function LegalDocument({ document }: LegalDocumentProps) {
  return (
    <div className="space-y-6 text-slate-700">
      {document.intro?.map((paragraph, index) => (
        <p key={`intro-${index}`} className="text-base leading-relaxed">
          {paragraph}
        </p>
      ))}
      {document.sections.map((section, index) => (
        <section key={`section-${index}`} className="space-y-4">
          {section.heading && (
            <h2 className="text-lg font-semibold text-slate-900">{section.heading}</h2>
          )}
          {section.paragraphs?.map((paragraph, paragraphIndex) => (
            <p key={`paragraph-${index}-${paragraphIndex}`} className="text-base leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.list && (
            <ul className="list-disc space-y-2 pl-6 text-base leading-relaxed">
              {section.list.map((item, itemIndex) => (
                <li key={`list-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
