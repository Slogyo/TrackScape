const handles = process.argv.slice(2)

for (const handle of handles) {
  const url = `https://peco-uk.com/products/${handle}`
  const response = await fetch(url, {
    headers: { 'user-agent': 'TrackScape catalog research' },
  })
  const html = await response.text()
  const downloads = [...html.matchAll(/href="([^"]+\.pdf[^"]*)"[^>]*>([^<]+)/gi)]
    .map((match) => ({
      url: match[1].replaceAll('&amp;', '&'),
      text: match[2].replace(/\s+/g, ' ').trim(),
    }))
  const specificationIndex = html.indexOf('Technical Specification')
  const specification =
    specificationIndex >= 0
      ? html
          .slice(specificationIndex, specificationIndex + 800)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : null

  console.log(
    JSON.stringify(
      {
        url,
        status: response.status,
        downloads,
        specification,
      },
      null,
      2,
    ),
  )
}
