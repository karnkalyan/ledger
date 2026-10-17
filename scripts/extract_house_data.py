import os
import glob
import re
import json
import fitz

def clean_num(val):
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(',', '').replace(' ', '')
    if not s or s == '-':
        return 0.0
    try:
        return float(s)
    except:
        return 0.0

def extract_folder_statements(folder_path, target_acc_num):
    pdf_files = sorted(glob.glob(os.path.join(folder_path, '*.pdf')))
    unique_pdfs = []
    seen_bases = set()
    for p in pdf_files:
        base = os.path.basename(p).replace(' (1)', '')
        if base in seen_bases:
            continue
        seen_bases.add(base)
        unique_pdfs.append(p)

    all_txs = []
    seen_keys = set()

    for pdf in unique_pdfs:
        doc = fitz.open(pdf)
        for page in doc:
            lines = [l.strip() for l in page.get_text('text').split('\n') if l.strip()]
            start_idx = 0
            end_idx = len(lines)
            for i, l in enumerate(lines):
                if l.startswith('It is understood and agreed'):
                    end_idx = i
                    break
            for i in range(end_idx):
                if lines[i] in ['Opening Balance', 'Closing Balance'] or re.match(r'^\d{4}-\d{2}-\d{2}', lines[i]):
                    if i > 0 and lines[i-1] in ['From :', 'To :']:
                        continue
                    start_idx = i
                    if lines[i].count('-') == 2 and i + 1 < end_idx and lines[i+1] == 'Opening Balance':
                        start_idx = i
                        break
                    elif re.match(r'^\d{4}-\d{2}-\d{2}', lines[i]):
                        start_idx = i
                        break

            table_lines = lines[start_idx:end_idx]
            i = 0
            while i < len(table_lines):
                line = table_lines[i]
                if re.match(r'^\d{4}-\d{2}-\d{2}', line):
                    tx_date = line[:10]
                    desc_parts = []
                    j = i + 1
                    while j < len(table_lines) and not re.match(r'^\d{4}-\d{2}-\d{2}', table_lines[j]):
                        desc_parts.append(table_lines[j])
                        j += 1

                    if len(desc_parts) >= 3:
                        sn = None
                        if desc_parts[-1].isdigit():
                            sn = desc_parts[-1]
                            desc_parts_no_sn = desc_parts[:-1]
                        else:
                            desc_parts_no_sn = desc_parts

                        if len(desc_parts_no_sn) >= 3:
                            bal_str = desc_parts_no_sn[-1]
                            dep_str = desc_parts_no_sn[-2]
                            wd_str = desc_parts_no_sn[-3]
                            desc = ' '.join(desc_parts_no_sn[:-3]).strip()
                            if not desc and desc_parts_no_sn:
                                desc = 'Bank Transaction'

                            wd_amt = clean_num(wd_str)
                            dep_amt = clean_num(dep_str)
                            bal_amt = clean_num(bal_str)

                            if desc.lower() not in ['opening balance', 'closing balance']:
                                tx_type = 'DEPOSIT' if dep_amt > 0 else 'WITHDRAWAL'
                                amt = dep_amt if dep_amt > 0 else wd_amt
                                key = (tx_date, tx_type, round(amt, 2), round(bal_amt, 2), desc[:50])
                                if key not in seen_keys and amt > 0:
                                    seen_keys.add(key)
                                    all_txs.append({
                                        'accountNumber': target_acc_num,
                                        'date': tx_date,
                                        'type': tx_type,
                                        'amount': amt,
                                        'balance': bal_amt,
                                        'description': desc,
                                        'reference': f"SN-{sn}" if sn else None,
                                        'source_pdf': os.path.basename(pdf),
                                    })
                    i = j
                else:
                    i += 1

    return all_txs

kashvi_txs = extract_folder_statements('houseDetails/Kashvi-siddhartha', '55509175153')
nimb_txs = extract_folder_statements('houseDetails/kalyan-nimb', '02905120254304')
kalyan_sid_txs = extract_folder_statements('houseDetails/Kalyan-siddhartha', '01615383041')

output = {
    '55509175153': kashvi_txs,
    '02905120254304': nimb_txs,
    '01615383041': kalyan_sid_txs,
}

out_path = 'scripts/extracted_house_data.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print(f"Extraction complete:")
print(f" - Kashvi Siddhartha (55509175153): {len(kashvi_txs)} transactions")
print(f" - Kalyan NIMB (02905120254304): {len(nimb_txs)} transactions")
print(f" - Kalyan Siddhartha (01615383041): {len(kalyan_sid_txs)} transactions")
print(f"Saved to {out_path}")
