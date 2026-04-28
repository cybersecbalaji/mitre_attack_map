const https = require('https');
let chunks = [];
https.get('https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json', res => {
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    
    // Show a full analytic object
    const analytic = bundle.objects.find(o => o.type === 'x-mitre-analytic' && o.x_mitre_log_source_references);
    console.log('Sample analytic with log_source_references:');
    console.log(JSON.stringify(analytic, null, 2).slice(0, 2000));
    
    // Count analytics with x_mitre_log_source_references
    const withLogRefs = bundle.objects.filter(o => o.type === 'x-mitre-analytic' && o.x_mitre_log_source_references && o.x_mitre_log_source_references.length > 0);
    console.log('\nAnalytics with x_mitre_log_source_references:', withLogRefs.length, 'of', bundle.objects.filter(o => o.type === 'x-mitre-analytic').length);
    
    // Show what x_mitre_log_source_references looks like
    if (withLogRefs[0]) {
      console.log('\nlog_source_references:', JSON.stringify(withLogRefs[0].x_mitre_log_source_references));
    }
    
    // Check if data-source objects (x-mitre-data-source) have relationship to data-components
    const dataSources = bundle.objects.filter(o => o.type === 'x-mitre-data-source');
    console.log('\nData sources count:', dataSources.length);
    if (dataSources[0]) console.log('Sample DS:', JSON.stringify({ id: dataSources[0].id, name: dataSources[0].name, keys: Object.keys(dataSources[0]) }));
    
    // Are there relationships from data-component to attack-pattern?
    const dcToAP = bundle.objects.filter(o => o.type === 'relationship' && o.source_ref && o.source_ref.startsWith('x-mitre-data-component'));
    console.log('\nData-component relationships:', dcToAP.length);
    if (dcToAP[0]) console.log('Sample:', JSON.stringify(dcToAP[0]));
  });
});
