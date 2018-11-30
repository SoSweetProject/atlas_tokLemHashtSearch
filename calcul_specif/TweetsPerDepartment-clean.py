# -*- coding: utf-8 -*-

from collections import defaultdict
import geopandas as gpd
import pandas as pd
import numpy as np
import argparse
import datetime
import sqlite3
import shapely
import ujson
import time
import sys

sys.stdout.write("---- Début du programme ----\n")

parser = argparse.ArgumentParser(description="calculates the specificities")
parser.add_argument('--corpus', '-c', required=True, help='path to the corpus in json format')
args = parser.parse_args()

departements=gpd.read_file("../departements.json")
corpus = args.corpus
data=[]

with open(corpus) as f:
    for i,l in enumerate(f):
        t=ujson.loads(l)
        if ("hashtags" in t) :
            data.append({'geometry':shapely.geometry.Point(t['geo']['longitude'],t['geo']['latitude']), 'melt':t['melt'], 'hashtags':t['hashtags']})
        else :
            data.append({'geometry':shapely.geometry.Point(t['geo']['longitude'],t['geo']['latitude']), 'melt':t['melt']})
allTweets=gpd.GeoDataFrame(data)
allTweets = allTweets.where(pd.notnull(allTweets), None)
allTweets.crs=departements.crs

sys.stdout.write("1/6 - Jointure entre les tweets et les départements\n")
allTweets_with_departments = gpd.sjoin(allTweets,departements, how="inner", op='intersects')

sys.stdout.write("2/6 - Sauvegarde de la jointure dans le .csv\n")
allTweets_with_departments.to_csv('tweets_with_departments.csv')


## freq by departement

def freqByDep(annotationType) :
    freqParDepartement=defaultdict(lambda : defaultdict(int))
    for i in range(allTweets_with_departments.shape[0]):
        percentage = round(i*100/allTweets_with_departments.shape[0])
        sys.stdout.write("\r3/6 - Calcul des fréquences - "+str(annotationType)+" : "+str(percentage)+"%")
        if annotationType == "hashtags" :
            if (allTweets_with_departments.iloc[i][annotationType] is not None) :
                for h in allTweets_with_departments.iloc[i][annotationType]:
                    freqParDepartement[allTweets_with_departments.iloc[i]['code']][h]+=1
        else :
            for t in allTweets_with_departments.iloc[i]['melt']:
                element = t[annotationType]
                freqParDepartement[allTweets_with_departments.iloc[i]['code']][element]+=1
    with open('freqParDepartement_'+annotationType+'.json', 'w') as f:
        f.write(ujson.dumps(freqParDepartement))
    sys.stdout.write("\r3/6 - Calcul des fréquences - "+str(annotationType)+" : 100%")
    sys.stdout.write("\n")
    return(freqParDepartement)

freqParDepartement_token = freqByDep("token")
freqParDepartement_lemme = freqByDep("lemme")
freqParDepartement_hashtag = freqByDep("hashtags")

df_lemme = pd.DataFrame(freqParDepartement_lemme).fillna(0)
df_token = pd.DataFrame(freqParDepartement_token).fillna(0)
df_hashtag = pd.DataFrame(freqParDepartement_hashtag).fillna(0)

sys.stdout.write("4/6 - Sauvegarde de la fréquence dans le .hdf - token\n")
df_token.to_hdf('freqParDepartement.hdf', 'tokens')
sys.stdout.write("4/6 - Sauvegarde de la fréquence dans le .hdf - lemme\n")
df_lemme.to_hdf('freqParDepartement.hdf', 'lemmes')
sys.stdout.write("4/6 - Sauvegarde de la fréquence dans le .hdf - hashtag\n")
df_hashtag.to_hdf('freqParDepartement.hdf', 'hashtags')


## Specificities

def specificities(lexicalTable,annotationType):
    from scipy.stats import hypergeom
    M=lexicalTable.sum().sum()
    lengths=pd.DataFrame(lexicalTable.sum())
    freq=pd.DataFrame(lexicalTable.sum(axis=1))
    expectedCounts=(freq.dot(lengths.transpose()))/M
    specif=lexicalTable.copy()
    for part in lexicalTable.columns:
        sys.stdout.write("\r5/6 - "+annotationType+" - Calcul des spécificités pour le département "+str(part))
        for word in lexicalTable.index:
            if lexicalTable.loc[word,part]<expectedCounts.loc[word,part] :
                specif.loc[word,part]=hypergeom.cdf(lexicalTable.loc[word,part],M, freq.loc[word], lengths.loc[part])
            else:
                specif.loc[word,part]=1-hypergeom.cdf(lexicalTable.loc[word,part]-1,M, freq.loc[word], lengths.loc[part])
    specif=np.log10(specif)
    specif[lexicalTable>=expectedCounts]=-specif[lexicalTable>=expectedCounts]
    sys.stdout.write("\n")
    # si on veut des valeurs tronquées
    for dep in specif :
        specif.loc[specif[dep] > 10,dep] = 10
        specif.loc[specif[dep] < -10,dep] = -10
    return specif

freqParDepartement_token = pd.read_hdf('freqParDepartement.hdf', 'tokens')
freqParDepartement_token = freqParDepartement_token.fillna(0)
freqParDepartement_token = freqParDepartement_token.loc[freqParDepartement_token.sum(axis=1)>10]

freqParDepartement_lemme = pd.read_hdf('freqParDepartement.hdf', 'lemmes')
freqParDepartement_lemme = freqParDepartement_lemme.fillna(0)
freqParDepartement_lemme = freqParDepartement_lemme.loc[freqParDepartement_lemme.sum(axis=1)>10]

freqParDepartement_hashtag = pd.read_hdf('freqParDepartement.hdf', 'hashtags')
freqParDepartement_hashtag = freqParDepartement_hashtag.fillna(0)
freqParDepartement_hashtag = freqParDepartement_hashtag.loc[freqParDepartement_hashtag.sum(axis=1)>10]

freqParDepartement_token = freqParDepartement_token.sort_index(axis = 1, ascending = True)
freqParDepartement_lemme = freqParDepartement_lemme.sort_index(axis = 1, ascending = True)
freqParDepartement_hashtag = freqParDepartement_hashtag.sort_index(axis = 1, ascending = True)

specif_token = specificities(freqParDepartement_token,"token")
specif_lemme = specificities(freqParDepartement_lemme,"lemme")
specif_hashtag = specificities(freqParDepartement_hashtag,"hashtag")

sys.stdout.write("\r6/6 - Écriture dans la base de données\n")

conn = sqlite3.connect("specif.db")

specif_token.to_sql("specif_token", conn, if_exists="replace")
freqParDepartement_token.to_sql("freq_token", conn, if_exists="replace")
specif_lemme.to_sql("specif_lemma", conn, if_exists="replace")
freqParDepartement_lemme.to_sql("freq_lemma", conn, if_exists="replace")
specif_hashtag.to_sql("specif_hashtag", conn, if_exists="replace")
freqParDepartement_hashtag.to_sql("freq_hashtag", conn, if_exists="replace")

conn.commit()
conn.close()

sys.stdout.write("\r---- Fin du programme ----\n")
