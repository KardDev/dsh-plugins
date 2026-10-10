// Legacy functional regressions exercise the optional detailed view explicitly.
import {configureViewSettings} from '../src/view-settings.js';
configureViewSettings({getSnapshot:()=>({value:{showDetails:true}}),subscribe:()=>()=>{}});
