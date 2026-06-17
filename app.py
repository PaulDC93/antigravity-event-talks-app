import os
import re
import json
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache.json')
CACHE_EXPIRY = 3600  # 1 hour

def parse_html_content(html_content):
    """Splits feed content by <h3> headers to get separate updates."""
    if not html_content:
        return []
    
    if '<h3>' not in html_content:
        return [{
            'type': 'Update',
            'content': html_content.strip()
        }]
        
    pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=(?:<h3>|$))', re.DOTALL)
    matches = pattern.findall(html_content)
    
    items = []
    for note_type, content in matches:
        items.append({
            'type': note_type.strip(),
            'content': content.strip()
        })
    return items

def clean_html(raw_html):
    """Strip HTML tags to create a clean plaintext summary."""
    clean_re = re.compile('<.*?>')
    text = re.sub(clean_re, '', raw_html)
    # Replace multiple spaces/newlines with a single space
    text = re.sub(r'\s+', ' ', text)
    # Replace common HTML entities
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return text.strip()

def parse_xml_feed(xml_text):
    """Parses BigQuery release notes Atom XML feed."""
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"XML Parse Error: {e}")
        return []
    
    entries = root.findall('atom:entry', namespaces)
    parsed_items = []
    
    for entry in entries:
        # Extract title (which represents the date, e.g., "June 17, 2026")
        title_el = entry.find('atom:title', namespaces)
        date_str = title_el.text.strip() if title_el is not None else "Unknown Date"
        
        # Extract ISO updated date
        updated_el = entry.find('atom:updated', namespaces)
        updated_iso = updated_el.text.strip() if updated_el is not None else ""
        
        # Extract anchor link
        link_el = entry.find('atom:link', namespaces)
        link = link_el.get('href') if link_el is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        
        # Extract unique feed ID
        id_el = entry.find('atom:id', namespaces)
        entry_id = id_el.text.strip() if id_el is not None else ""
        
        # Extract HTML content
        content_el = entry.find('atom:content', namespaces)
        html_content = content_el.text if content_el is not None else ""
        
        # Split daily update into individual feature/announcement items
        items_in_entry = parse_html_content(html_content)
        
        for idx, item in enumerate(items_in_entry):
            sub_id = f"{entry_id}_{idx}" if entry_id else f"{date_str.replace(' ', '_')}_{idx}"
            clean_text = clean_html(item['content'])
            summary = clean_text[:200] + "..." if len(clean_text) > 200 else clean_text
            
            parsed_items.append({
                'id': sub_id,
                'date': date_str,
                'iso_date': updated_iso,
                'link': link,
                'type': item['type'],
                'content': item['content'],
                'summary': summary
            })
            
    return parsed_items

def get_feed_data(force_refresh=False):
    """Retrieves feed data from local cache or fetches from Google feed."""
    if not force_refresh and os.path.exists(CACHE_FILE):
        file_time = os.path.getmtime(CACHE_FILE)
        if time.time() - file_time < CACHE_EXPIRY:
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error reading cache: {e}")
                
    # Fetch from Google BigQuery Release Notes RSS Feed
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        r = requests.get(FEED_URL, headers=headers, timeout=15)
        r.raise_for_status()
        xml_text = r.text
        releases = parse_xml_feed(xml_text)
        
        # Save to cache
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(releases, f, indent=2, ensure_ascii=False)
            
        return releases
    except Exception as e:
        print(f"Error fetching feed: {e}")
        # Fallback to cache if available
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                pass
        return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    data = get_feed_data()
    return jsonify(data)

@app.route('/api/refresh')
def force_refresh_releases():
    data = get_feed_data(force_refresh=True)
    return jsonify(data)

if __name__ == '__main__':
    # Running flask app on localhost port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
