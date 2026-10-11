import urllib.request
import json
url = 'https://3d.nih.gov/api/models?q=heart&limit=3'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8')[:2000])
except Exception as e:
    print(e)
