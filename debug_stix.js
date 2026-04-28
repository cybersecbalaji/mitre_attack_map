const https = require('https');
let chunks = [];
const req = https.get('https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json', res => {
  res.on('data', chunk => { chunks.push(chunk); });
  res.on('end', analyse);
});

function analyse() {
  const body = Buffer.concat(chunks).toString('utf8');
  console.log('Raw bytes:', body.length);
  
  const bundle = JSON.parse(body);
  console.log('bundle.objects count:', bundle.objects.length);
  
  const typeCounts = {};
  for (const obj of bundle.objects) {
    typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
  }
  // Sort by count
  const sorted = Object.entries(typeCounts).sort((a,b) => b[1] - a[1]);
  console.log('Object type counts:', JSON.stringify(sorted));
  
  // Check a detection-strategy
  const strat = bundle.objects.find(o => o.type === 'x-mitre-detection-strategy');
  if (strat) {
    console.log('\nSample detection-strategy keys:', Object.keys(strat));
    console.log('Has x_mitre_analytic_refs:', 'x_mitre_analytic_refs' in strat, Array.isArray(strat.x_mitre_analytic_refs) ? strat.x_mitre_analytic_refs.length + ' refs' : strat.x_mitre_analytic_refs);
  } else {
    console.log('NO detection-strategy in bundle.objects!');
  }
  
  // Check an analytic
  const analytic = bundle.objects.find(o => o.type === 'x-mitre-analytic');
  if (analytic) {
    console.log('\nSample analytic keys:', Object.keys(analytic));
    console.log('Has x_mitre_data_component_ref:', 'x_mitre_data_component_ref' in analytic, analytic.x_mitre_data_component_ref);
  } else {
    console.log('NO x-mitre-analytic in bundle.objects!');
  }
  
  // Simulate the parsing
  const stixIdToAttackId = new Map();
  const dataComponentByStixId = new Map();
  const analyticByStixId = new Map();
  const detectionStrategyByStixId = new Map();
  const detectsRels = [];
  
  for (const obj of bundle.objects) {
    if (obj.type === 'attack-pattern' && !obj.x_mitre_deprecated && !obj.revoked) {
      const ref = (obj.external_references || []).find(r => r.source_name === 'mitre-attack');
      if (ref && ref.external_id) stixIdToAttackId.set(obj.id, ref.external_id);
    } else if (obj.type === 'x-mitre-data-component') {
      const extId = (obj.external_references || []).find(r => r.source_name === 'mitre-attack');
      dataComponentByStixId.set(obj.id, { name: obj.name, externalId: extId ? extId.external_id : '' });
    } else if (obj.type === 'x-mitre-analytic') {
      if (obj.x_mitre_data_component_ref) analyticByStixId.set(obj.id, { dataComponentRef: obj.x_mitre_data_component_ref });
    } else if (obj.type === 'x-mitre-detection-strategy') {
      if (obj.x_mitre_analytic_refs && obj.x_mitre_analytic_refs.length) {
        detectionStrategyByStixId.set(obj.id, { analyticRefs: obj.x_mitre_analytic_refs });
      }
    } else if (obj.type === 'relationship' && obj.relationship_type === 'detects') {
      detectsRels.push({ sourceRef: obj.source_ref, targetRef: obj.target_ref });
    }
  }
  
  console.log('\nParsing results:');
  console.log('stixIdToAttackId:', stixIdToAttackId.size);
  console.log('dataComponentByStixId:', dataComponentByStixId.size);
  console.log('analyticByStixId:', analyticByStixId.size);
  console.log('detectionStrategyByStixId:', detectionStrategyByStixId.size);
  console.log('detectsRels:', detectsRels.length);
  
  // Build techDataSources
  const techDataSources = new Map();
  let matched = 0, noAttackId = 0, noStrategy = 0, noAnalytic = 0, noDC = 0;
  
  for (const { sourceRef, targetRef } of detectsRels) {
    const attackId = stixIdToAttackId.get(targetRef);
    if (!attackId) { noAttackId++; continue; }
    
    const strategy = detectionStrategyByStixId.get(sourceRef);
    if (!strategy) { noStrategy++; continue; }
    
    for (const analyticRef of strategy.analyticRefs) {
      const analytic = analyticByStixId.get(analyticRef);
      if (!analytic) { noAnalytic++; continue; }
      const dc = dataComponentByStixId.get(analytic.dataComponentRef);
      if (!dc) { noDC++; continue; }
      
      const list = techDataSources.get(attackId) || [];
      list.push({ id: dc.externalId || dc.name.toLowerCase().replace(/\s+/g, '-'), name: dc.name });
      techDataSources.set(attackId, list);
      matched++;
    }
  }
  
  console.log('\ntechDataSources resolution:');
  console.log('matched:', matched);
  console.log('noAttackId:', noAttackId);
  console.log('noStrategy:', noStrategy);
  console.log('noAnalytic:', noAnalytic);
  console.log('noDC:', noDC);
  console.log('techDataSources entries:', techDataSources.size);
  
  if (techDataSources.size > 0) {
    const [k, v] = techDataSources.entries().next().value;
    console.log('Sample:', k, v[0]);
  }
}

req.on('error', e => console.error(e.message));
